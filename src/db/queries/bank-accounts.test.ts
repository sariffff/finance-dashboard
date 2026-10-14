import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { client, db } from "@/db";
import { user, type BankAccount } from "@/db/schema";

import {
  createBankAccount,
  deleteBankAccount,
  getBankAccount,
  listBankAccounts,
} from "./bank-accounts";

// Integration test against the real database: there is no row-level
// security, so the userId filter in every query is the only thing keeping
// users apart. Requires `docker compose up -d` and migrations applied.

const userA = { id: randomUUID(), name: "User A", email: `a-${randomUUID()}@test.local` };
const userB = { id: randomUUID(), name: "User B", email: `b-${randomUUID()}@test.local` };

let accountA: BankAccount;
let accountB: BankAccount;

beforeAll(async () => {
  await db.insert(user).values([userA, userB]);
  accountA = await createBankAccount(userA.id, { bankCode: "scb", nickname: "A's account" });
  accountB = await createBankAccount(userB.id, { bankCode: "kbank", nickname: "B's account" });
});

afterAll(async () => {
  // Deleting the users cascades to their bank accounts.
  await db.delete(user).where(inArray(user.id, [userA.id, userB.id]));
  await client.end();
});

describe("bank account queries are scoped to their owner", () => {
  it("lists only the caller's own accounts", async () => {
    const accounts = await listBankAccounts(userA.id);
    expect(accounts.map((a) => a.id)).toEqual([accountA.id]);
  });

  it("cannot read another user's account by id", async () => {
    expect(await getBankAccount(userA.id, accountB.id)).toBeUndefined();
    expect(await getBankAccount(userB.id, accountB.id)).toMatchObject({
      id: accountB.id,
      userId: userB.id,
    });
  });

  it("cannot delete another user's account", async () => {
    expect(await deleteBankAccount(userA.id, accountB.id)).toBe(false);
    expect(await getBankAccount(userB.id, accountB.id)).toBeDefined();
  });
});
