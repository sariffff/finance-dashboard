import { randomUUID } from "node:crypto";

import { inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { client, db } from "@/db";
import { categories, transactions, user, type BankAccount } from "@/db/schema";

import { createBankAccount } from "./bank-accounts";
import {
  getMonthTotals,
  getMonthlyTotals,
  getSpendingByCategory,
  listActiveMonths,
} from "./dashboard";
import { listTransactions } from "./transactions";

// Integration test against the real database (migrated and seeded).

const owner = { id: randomUUID(), name: "Owner", email: `dash-${randomUUID()}@test.local` };
const other = { id: randomUUID(), name: "Other", email: `dash-other-${randomUUID()}@test.local` };
let savings: BankAccount;
let card: BankAccount;
let food: string;
let travel: string;

beforeAll(async () => {
  await db.insert(user).values([owner, other]);
  savings = await createBankAccount(owner.id, { bankCode: "scb", nickname: "ออมทรัพย์" });
  card = await createBankAccount(owner.id, { bankCode: "scb", nickname: "อีกบัญชี" });
  const otherAccount = await createBankAccount(other.id, { bankCode: "scb", nickname: "x" });

  const builtIn = await db.select().from(categories).where(isNull(categories.userId));
  food = builtIn.find((c) => c.name === "อาหารและเครื่องดื่ม")!.id;
  travel = builtIn.find((c) => c.name === "เดินทาง")!.id;

  const row = (
    occurredAt: string,
    amount: string,
    direction: "in" | "out",
    description: string,
    extra: { categoryId?: string; bankAccountId?: string; userId?: string } = {},
  ) => ({
    userId: extra.userId ?? owner.id,
    bankAccountId: extra.bankAccountId ?? savings.id,
    occurredAt,
    amount,
    direction,
    description,
    categoryId: extra.categoryId ?? null,
    dedupeHash: randomUUID(),
  });

  await db.insert(transactions).values([
    // July
    row("2026-07-15", "1000.00", "out", "ค่าเช่า"),
    // September (August is empty on purpose)
    row("2026-09-01", "35000.00", "in", "เงินเดือน"),
    row("2026-09-01", "0.10", "out", "ร้านกาแฟ 50% off", { categoryId: food }),
    row("2026-09-30", "0.20", "out", "ร้านข้าว", { categoryId: food }),
    row("2026-09-15", "89.50", "out", "GRAB", { categoryId: travel, bankAccountId: card.id }),
    row("2026-09-20", "300.00", "out", "ไม่รู้หมวด"),
    // October 1st belongs to October, not September
    row("2026-10-01", "999.00", "out", "ต้นเดือน"),
    // Someone else's money must never show up
    row("2026-09-10", "77777.00", "out", "ของคนอื่น", { userId: other.id, bankAccountId: otherAccount.id }),
  ]);
});

afterAll(async () => {
  await db.delete(user).where(inArray(user.id, [owner.id, other.id]));
  await client.end();
});

describe("dashboard aggregates", () => {
  it("sums one month exactly, in satang", async () => {
    expect(await getMonthTotals(owner.id, "2026-09")).toEqual({
      inSatang: 3_500_000,
      outSatang: 10 + 20 + 8950 + 30000,
    });
    expect(await getMonthTotals(owner.id, "2026-08")).toEqual({ inSatang: 0, outSatang: 0 });
  });

  it("groups spending by category, largest first, with uncategorized as null", async () => {
    expect(await getSpendingByCategory(owner.id, "2026-09")).toEqual([
      { categoryId: null, name: null, totalSatang: 30000, count: 1 },
      { categoryId: travel, name: "เดินทาง", totalSatang: 8950, count: 1 },
      { categoryId: food, name: "อาหารและเครื่องดื่ม", totalSatang: 30, count: 2 },
    ]);
  });

  it("returns every month in the range, filling empty months with zero", async () => {
    expect(await getMonthlyTotals(owner.id, "2026-10", 4)).toEqual([
      { month: "2026-07", inSatang: 0, outSatang: 100_000 },
      { month: "2026-08", inSatang: 0, outSatang: 0 },
      { month: "2026-09", inSatang: 3_500_000, outSatang: 38_980 },
      { month: "2026-10", inSatang: 0, outSatang: 99_900 },
    ]);
  });

  it("lists months that have data, newest first", async () => {
    expect(await listActiveMonths(owner.id)).toEqual(["2026-10", "2026-09", "2026-07"]);
  });
});

describe("listTransactions", () => {
  it("filters by month, category, account and text, and counts the total", async () => {
    expect((await listTransactions(owner.id, { month: "2026-09" })).total).toBe(5);
    expect((await listTransactions(owner.id, { categoryId: food })).total).toBe(2);
    expect((await listTransactions(owner.id, { categoryId: "none" })).total).toBe(4);
    expect((await listTransactions(owner.id, { bankAccountId: card.id })).rows.map((r) => r.description)).toEqual(["GRAB"]);
    expect((await listTransactions(owner.id, { q: "grab" })).total).toBe(1);
  });

  it("matches search text literally, including LIKE wildcards", async () => {
    expect((await listTransactions(owner.id, { q: "50%" })).rows.map((r) => r.description)).toEqual(["ร้านกาแฟ 50% off"]);
    expect((await listTransactions(owner.id, { q: "_" })).total).toBe(0);
  });

  it("pages newest first", async () => {
    const first = await listTransactions(owner.id, {}, { page: 1, pageSize: 3 });
    const third = await listTransactions(owner.id, {}, { page: 3, pageSize: 3 });
    expect(first).toMatchObject({ total: 7, pageCount: 3 });
    expect(first.rows[0].description).toBe("ต้นเดือน");
    expect(third.rows.map((r) => r.description)).toEqual(["ค่าเช่า"]);
  });

  it("never returns another user's transactions", async () => {
    const result = await listTransactions(owner.id, { q: "ของคนอื่น" });
    expect(result.total).toBe(0);
  });
});
