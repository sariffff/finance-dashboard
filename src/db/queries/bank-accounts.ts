import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { bankAccounts, type BankAccount } from "@/db/schema";

// Every query takes the owner's userId first and filters on it. Callers get
// that id from requireUser() in src/lib/dal.ts, never from client input.

export function listBankAccounts(userId: string): Promise<BankAccount[]> {
  return db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.userId, userId))
    .orderBy(asc(bankAccounts.createdAt));
}

export async function getBankAccount(
  userId: string,
  id: string,
): Promise<BankAccount | undefined> {
  const [account] = await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.id, id)));
  return account;
}

export async function createBankAccount(
  userId: string,
  input: { bankCode: string; nickname: string },
): Promise<BankAccount> {
  const [account] = await db
    .insert(bankAccounts)
    .values({ ...input, userId })
    .returning();
  return account;
}

export async function deleteBankAccount(
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(bankAccounts)
    .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.id, id)))
    .returning({ id: bankAccounts.id });
  return deleted.length > 0;
}
