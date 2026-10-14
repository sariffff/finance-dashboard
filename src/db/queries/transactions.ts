import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { bankAccounts, categories, transactions } from "@/db/schema";

// Every query takes the owner's userId first and filters on it. Callers get
// that id from requireUser() in src/lib/dal.ts, never from client input.

export function listRecentTransactions(userId: string, limit = 100) {
  return db
    .select({
      id: transactions.id,
      occurredAt: transactions.occurredAt,
      occurredTime: transactions.occurredTime,
      description: transactions.description,
      merchant: transactions.merchant,
      amount: transactions.amount,
      direction: transactions.direction,
      categoryId: transactions.categoryId,
      categorySource: transactions.categorySource,
      categoryName: categories.name,
      bankNickname: bankAccounts.nickname,
    })
    .from(transactions)
    .innerJoin(bankAccounts, eq(bankAccounts.id, transactions.bankAccountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.occurredAt), desc(transactions.occurredTime), desc(transactions.createdAt))
    .limit(limit);
}

export type RecentTransaction = Awaited<ReturnType<typeof listRecentTransactions>>[number];
