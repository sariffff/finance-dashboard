import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { client, db } from "@/db";
import { transactions, user, type BankAccount } from "@/db/schema";
import { expectedTransactions } from "@/lib/parsers/__fixtures__/scb-sample-data";
import type { ParsedStatement } from "@/lib/parsers/types";

import { createBankAccount } from "./bank-accounts";
import {
  ImportNotFoundError,
  cancelImport,
  confirmImport,
  createPendingImport,
  findExistingDedupeHashes,
  getImport,
} from "./imports";

// Integration test against the real database (docker compose up -d).

const owner = { id: randomUUID(), name: "Owner", email: `owner-${randomUUID()}@test.local` };
const other = { id: randomUUID(), name: "Other", email: `other-${randomUUID()}@test.local` };
const statement: ParsedStatement = { transactions: expectedTransactions(), warnings: [] };

let account: BankAccount;
let otherAccount: BankAccount;

beforeAll(async () => {
  await db.insert(user).values([owner, other]);
  account = await createBankAccount(owner.id, { bankCode: "scb", nickname: "SCB" });
  otherAccount = await createBankAccount(other.id, { bankCode: "scb", nickname: "SCB" });
});

afterAll(async () => {
  await db.delete(user).where(inArray(user.id, [owner.id, other.id]));
  await client.end();
});

function pending(bankAccountId = account.id) {
  return createPendingImport(owner.id, {
    bankAccountId,
    fileName: "statement.pdf",
    fileType: "pdf",
    statement,
  });
}

describe("statement import", () => {
  it("saves every row, then skips all of them on a second import", async () => {
    const first = await pending();
    expect(await confirmImport(owner.id, first.id)).toEqual({
      inserted: statement.transactions.length,
      duplicates: 0,
    });

    const saved = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, owner.id), eq(transactions.importId, first.id)));
    expect(saved).toHaveLength(statement.transactions.length);
    // numeric(14,2) round-trips exactly; the two identical rows both exist.
    expect(saved.find((t) => t.description === "ชำระค่าไฟฟ้า การไฟฟ้านครหลวง")?.amount).toBe("1250.75");
    expect(saved.filter((t) => t.description === "ร้านน้ำปั่นหน้าออฟฟิศ")).toHaveLength(2);

    const completed = await getImport(owner.id, first.id);
    expect(completed).toMatchObject({ status: "completed", preview: null });

    const second = await pending();
    expect(await confirmImport(owner.id, second.id)).toEqual({
      inserted: 0,
      duplicates: statement.transactions.length,
    });
  });

  it("cannot confirm the same import twice", async () => {
    const created = await pending();
    await confirmImport(owner.id, created.id);
    await expect(confirmImport(owner.id, created.id)).rejects.toThrow(ImportNotFoundError);
  });

  it("keeps imports private to their owner", async () => {
    const created = await pending();

    expect(await getImport(other.id, created.id)).toBeUndefined();
    await expect(confirmImport(other.id, created.id)).rejects.toThrow(ImportNotFoundError);
    expect(await cancelImport(other.id, created.id)).toBe(false);
    expect(await findExistingDedupeHashes(other.id, ["anything"])).toEqual(new Set());

    expect(await cancelImport(owner.id, created.id)).toBe(true);
    expect(await getImport(owner.id, created.id)).toBeUndefined();
  });

  it("refuses to import into someone else's bank account", async () => {
    await expect(pending(otherAccount.id)).rejects.toThrow(ImportNotFoundError);
  });
});
