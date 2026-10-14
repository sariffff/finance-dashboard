import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { client, db } from "@/db";
import { transactions, user, type BankAccount } from "@/db/schema";
import type { ParsedTransaction } from "@/lib/parsers/types";

import { createBankAccount } from "./bank-accounts";
import { confirmImport, createPendingImport, findCrossSourceDuplicates } from "./imports";

// Integration test against the real database: a transfer recorded from a
// slip must not be counted again when the statement arrives, and vice versa.

const owner = { id: randomUUID(), name: "Owner", email: `xsrc-${randomUUID()}@test.local` };
let account: BankAccount;
let otherAccount: BankAccount;

beforeAll(async () => {
  await db.insert(user).values(owner);
  account = await createBankAccount(owner.id, { bankCode: "kbank", nickname: "KBank" });
  otherAccount = await createBankAccount(owner.id, { bankCode: "scb", nickname: "SCB" });
});

afterAll(async () => {
  await db.delete(user).where(inArray(user.id, [owner.id]));
  await client.end();
});

function tx(occurredAt: string, baht: number, description: string): ParsedTransaction {
  return {
    occurredAt,
    occurredTime: null,
    description,
    amountSatang: baht * 100,
    direction: "out",
    balanceSatang: null,
    code: null,
    channel: null,
  };
}

async function importRows(
  fileType: "pdf" | "slip",
  rows: ParsedTransaction[],
  bankAccountId = account.id,
) {
  const pending = await createPendingImport(owner.id, {
    bankAccountId,
    fileName: fileType === "slip" ? "slip.jpg" : "statement.pdf",
    fileType,
    statement: { transactions: rows, warnings: [] },
  });
  return confirmImport(owner.id, pending.id);
}

async function countOn(date: string) {
  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.userId, owner.id), eq(transactions.occurredAt, date)));
  return rows.length;
}

describe("slip and statement for the same transfer", () => {
  it("skips the statement line when a slip already recorded it", async () => {
    await importRows("slip", [tx("2026-10-08", 15000, "โอนไป เจ้าของห้องเช่า")]);

    const result = await importRows("pdf", [
      tx("2026-10-08", 15000, "Transfer Withdrawal To SCB X7788 ค่าเช่าห้อง"),
      tx("2026-10-08", 59, "Debit Card Spending 7-ELEVEN"),
    ]);

    expect(result).toEqual({ inserted: 1, duplicates: 1 });
    expect(await countOn("2026-10-08")).toBe(2); // the slip + the 7-Eleven line
  });

  it("flags a slip for a transfer the statement already has", async () => {
    await importRows("pdf", [tx("2026-10-12", 890, "Debit Card Spending โรงพยาบาล")]);

    const duplicates = await findCrossSourceDuplicates(db, owner.id, {
      bankAccountId: account.id,
      fileType: "slip",
      rows: [tx("2026-10-12", 890, "โอนไป โรงพยาบาล")],
    });
    expect(duplicates).toEqual(new Set([0]));
  });

  it("only matches within the same bank account", async () => {
    await importRows("slip", [tx("2026-10-20", 700, "โอนไป ปั๊มน้ำมัน")]);

    const result = await importRows("pdf", [tx("2026-10-20", 700, "PTT STATION")], otherAccount.id);
    expect(result).toEqual({ inserted: 1, duplicates: 0 });
  });
});
