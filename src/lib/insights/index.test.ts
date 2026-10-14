import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { client, db } from "@/db";
import { createBankAccount } from "@/db/queries/bank-accounts";
import { monthlyInsights, transactions, user, type BankAccount } from "@/db/schema";

import type { InsightWriter } from "./ai";
import { getMonthlyInsight } from "./index";

// Integration test against the real database; the AI is always a stub.

const owner = { id: randomUUID(), name: "Owner", email: `ins-${randomUUID()}@test.local` };
const other = { id: randomUUID(), name: "Other", email: `ins-other-${randomUUID()}@test.local` };
let account: BankAccount;

beforeAll(async () => {
  await db.insert(user).values([owner, other]);
  account = await createBankAccount(owner.id, { bankCode: "scb", nickname: "SCB" });
  await addTransaction("2026-09-25", "35000.00", "in");
  await addTransaction("2026-09-10", "1250.75", "out");
});

afterAll(async () => {
  await db.delete(user).where(inArray(user.id, [owner.id, other.id]));
  await client.end();
});

function addTransaction(occurredAt: string, amount: string, direction: "in" | "out") {
  return db.insert(transactions).values({
    userId: owner.id,
    bankAccountId: account.id,
    occurredAt,
    amount,
    direction,
    description: "รายการทดสอบ",
    dedupeHash: randomUUID(),
  });
}

function stubWriter(bullets: string[]) {
  const write = vi.fn<InsightWriter["write"]>(async () => bullets);
  return { writer: { model: "stub-model", write }, write };
}

describe("getMonthlyInsight", () => {
  it("sends only aggregated facts to the AI, never transactions", async () => {
    const { writer, write } = stubWriter(["ใช้จ่าย ฿1,250.75"]);
    await getMonthlyInsight(owner.id, "2026-09", writer);

    const sent = JSON.stringify(write.mock.calls[0][0]);
    expect(sent).toContain("1,250.75");
    expect(sent).not.toContain("รายการทดสอบ");
  });

  it("caches the AI text and reuses it while the numbers are unchanged", async () => {
    const first = stubWriter(["เดือนนี้ใช้จ่าย ฿1,250.75"]);
    // A different stub model invalidates the entry from the previous test.
    first.writer.model = "stub-model-2";
    expect(await getMonthlyInsight(owner.id, "2026-09", first.writer)).toEqual({
      bullets: ["เดือนนี้ใช้จ่าย ฿1,250.75"],
      source: "ai",
    });

    const second = stubWriter(["should not be used"]);
    second.writer.model = "stub-model-2";
    expect(await getMonthlyInsight(owner.id, "2026-09", second.writer)).toEqual({
      bullets: ["เดือนนี้ใช้จ่าย ฿1,250.75"],
      source: "ai",
    });
    expect(second.write).not.toHaveBeenCalled();
  });

  it("writes a new summary once the month's numbers change", async () => {
    await addTransaction("2026-09-11", "100.00", "out");
    const { writer, write } = stubWriter(["ใช้จ่ายรวม ฿1,350.75"]);
    writer.model = "stub-model-2";

    expect(await getMonthlyInsight(owner.id, "2026-09", writer)).toMatchObject({
      bullets: ["ใช้จ่ายรวม ฿1,350.75"],
    });
    expect(write).toHaveBeenCalledOnce();
    const rows = await db.select().from(monthlyInsights).where(eq(monthlyInsights.userId, owner.id));
    expect(rows).toHaveLength(1);
  });

  it("falls back to the rule-based summary when the AI invents numbers or fails", async () => {
    const invented = stubWriter(["ใช้จ่ายราว ฿1,400"]);
    invented.writer.model = "stub-model-3";
    expect(await getMonthlyInsight(owner.id, "2026-09", invented.writer)).toMatchObject({ source: "rules" });

    const failing: InsightWriter = {
      model: "stub-model-4",
      write: async () => {
        throw new Error("overloaded");
      },
    };
    const result = await getMonthlyInsight(owner.id, "2026-09", failing);
    expect(result?.source).toBe("rules");
    expect(result?.bullets[0]).toContain("฿1,350.75");
  });

  it("works without AI, and returns nothing for a month without data", async () => {
    expect(await getMonthlyInsight(owner.id, "2026-09", null)).toMatchObject({ source: "rules" });
    expect(await getMonthlyInsight(owner.id, "2026-08", null)).toBeNull();
  });

  it("never shows one user's insight to another", async () => {
    const { writer, write } = stubWriter(["anything"]);
    writer.model = "stub-model-2";
    expect(await getMonthlyInsight(other.id, "2026-09", writer)).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
});
