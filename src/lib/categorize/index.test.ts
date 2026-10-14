import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { client, db } from "@/db";
import { createBankAccount } from "@/db/queries/bank-accounts";
import { createUserRule, setTransactionCategory } from "@/db/queries/categories";
import { categories, categoryRules, transactions, user, type BankAccount } from "@/db/schema";

import type { AiCategorizer } from "./ai";
import { categorizeUncategorized } from "./index";

// Integration test against the real database. Needs `npm run db:migrate`
// and `npm run db:seed` (built-in categories and system rules).

const owner = { id: randomUUID(), name: "Owner", email: `cat-${randomUUID()}@test.local` };
const other = { id: randomUUID(), name: "Other", email: `cat-other-${randomUUID()}@test.local` };
let account: BankAccount;
let categoryId: (name: string) => string;

beforeAll(async () => {
  await db.insert(user).values([owner, other]);
  account = await createBankAccount(owner.id, { bankCode: "scb", nickname: "SCB" });
  const builtIn = await db.select().from(categories).where(isNull(categories.userId));
  categoryId = (name) => builtIn.find((c) => c.name === name)!.id;
});

afterAll(async () => {
  await db.delete(user).where(inArray(user.id, [owner.id, other.id]));
  await client.end();
});

async function addTransactions(rows: { description: string; direction?: "in" | "out" }[]) {
  return db
    .insert(transactions)
    .values(
      rows.map((row) => ({
        userId: owner.id,
        bankAccountId: account.id,
        occurredAt: "2026-09-01",
        description: row.description,
        amount: "100.00",
        direction: row.direction ?? "out",
        dedupeHash: randomUUID(),
      })),
    )
    .returning({ id: transactions.id });
}

async function categoryOf(transactionId: string) {
  const [row] = await db
    .select({ categoryId: transactions.categoryId, source: transactions.categorySource, merchant: transactions.merchant })
    .from(transactions)
    .where(eq(transactions.id, transactionId));
  return row;
}

describe("categorizeUncategorized", () => {
  it("uses rules first, asks the AI once per description, then caches the merchant", async () => {
    const [eleven, somtam1, somtam2, transferIn] = await addTransactions([
      { description: "จ่ายบิล 7-ELEVEN สาขาสุขุมวิท" }, // system rule
      { description: "ร้านอาหารส้มตำนัว" },
      { description: "ร้านอาหารส้มตำนัว" },
      { description: "รับโอนจาก PromptPay นาย สมชาย ใจดี", direction: "in" },
    ]);

    const categorizer = vi.fn<AiCategorizer>(async (items) =>
      items
        .filter((item) => item.description.includes("ส้มตำ"))
        .map((item) => ({ id: item.id, categoryName: "อาหารและเครื่องดื่ม", merchant: "ส้มตำนัว" })),
    );

    const stats = await categorizeUncategorized(owner.id, { categorizer });

    expect(stats).toEqual({ byRule: 1, byAi: 2, uncategorized: 1, aiFailed: false });
    // One AI request covering one row per distinct description.
    expect(categorizer).toHaveBeenCalledTimes(1);
    expect(categorizer.mock.calls[0][0].map((item) => item.description)).toEqual([
      "ร้านอาหารส้มตำนัว",
      "รับโอนจาก PromptPay นาย สมชาย ใจดี",
    ]);

    expect(await categoryOf(eleven.id)).toMatchObject({ categoryId: categoryId("อาหารและเครื่องดื่ม"), source: "rule" });
    for (const tx of [somtam1, somtam2]) {
      expect(await categoryOf(tx.id)).toEqual({
        categoryId: categoryId("อาหารและเครื่องดื่ม"),
        source: "ai",
        merchant: "ส้มตำนัว",
      });
    }
    expect(await categoryOf(transferIn.id)).toMatchObject({ categoryId: null, source: null });

    const cached = await db
      .select()
      .from(categoryRules)
      .where(and(eq(categoryRules.userId, owner.id), eq(categoryRules.source, "ai_cache")));
    expect(cached.map((rule) => rule.pattern)).toEqual(["ส้มตำนัว"]);
  });

  it("doesn't call the AI again for a merchant it has already seen", async () => {
    const [somtamBranch] = await addTransactions([{ description: "ส้มตำนัว สาขา 2" }]);
    const categorizer = vi.fn<AiCategorizer>(async () => []);

    const stats = await categorizeUncategorized(owner.id, { categorizer });

    // Only the still-uncategorized incoming transfer goes to the AI.
    expect(categorizer.mock.calls[0][0].map((item) => item.description)).toEqual([
      "รับโอนจาก PromptPay นาย สมชาย ใจดี",
    ]);
    expect(stats.byRule).toBe(1);
    expect(await categoryOf(somtamBranch.id)).toMatchObject({ source: "rule" });
  });

  it("leaves rows uncategorized when the AI fails", async () => {
    const [unknown] = await addTransactions([{ description: "ร้านที่ไม่มีใครรู้จัก" }]);
    const stats = await categorizeUncategorized(owner.id, {
      categorizer: async () => {
        throw new Error("timeout");
      },
    });

    expect(stats.aiFailed).toBe(true);
    expect(await categoryOf(unknown.id)).toMatchObject({ categoryId: null });
  });

  it("works without AI configured", async () => {
    const stats = await categorizeUncategorized(owner.id, { categorizer: null });
    expect(stats).toMatchObject({ byAi: 0, aiFailed: false });
  });
});

describe("user corrections", () => {
  it("never overwrites a category the user chose, and a user rule re-categorizes the rest", async () => {
    const [pinned, grab1, grab2] = await addTransactions([
      { description: "GRAB* A-111 ค่าเดินทาง" },
      { description: "GRAB* A-222" },
      { description: "GRAB* A-333" },
    ]);
    const shopping = categoryId("ช้อปปิ้ง");
    const food = categoryId("อาหารและเครื่องดื่ม");

    await categorizeUncategorized(owner.id, { categorizer: null }); // system rule: เดินทาง
    expect(await setTransactionCategory(owner.id, pinned.id, shopping)).toBeDefined();

    // "Use อาหาร for GRAB every time"
    expect(await createUserRule(owner.id, "GRAB", food)).toBe(2);
    expect(await categoryOf(pinned.id)).toMatchObject({ categoryId: shopping, source: "user" });
    expect(await categoryOf(grab1.id)).toMatchObject({ categoryId: food, source: "rule" });
    expect(await categoryOf(grab2.id)).toMatchObject({ categoryId: food, source: "rule" });

    // The user rule now beats the system rule for new imports too.
    const [grab3] = await addTransactions([{ description: "GRAB* A-444" }]);
    await categorizeUncategorized(owner.id, { categorizer: null });
    expect(await categoryOf(grab3.id)).toMatchObject({ categoryId: food });
  });

  it("rejects categories that don't fit, and other users' transactions", async () => {
    const [spending] = await addTransactions([{ description: "ร้านค้า" }]);
    expect(await setTransactionCategory(owner.id, spending.id, categoryId("เงินเดือน"))).toBeUndefined();
    expect(await setTransactionCategory(other.id, spending.id, categoryId("ช้อปปิ้ง"))).toBeUndefined();
  });

  it("doesn't use another user's rules", async () => {
    await db.insert(categoryRules).values({
      userId: other.id,
      pattern: "ร้านลับ",
      matchType: "contains",
      categoryId: categoryId("บันเทิง"),
      source: "user",
    });
    const [secret] = await addTransactions([{ description: "ร้านลับ" }]);
    await categorizeUncategorized(owner.id, { categorizer: null });
    expect(await categoryOf(secret.id)).toMatchObject({ categoryId: null });
  });
});
