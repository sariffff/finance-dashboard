import { and, count, desc, eq, gte, ilike, isNull, lt, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { bankAccounts, categories, transactions } from "@/db/schema";
import { monthRange } from "@/lib/month";

import { escapeLike } from "./like";

// Every query takes the owner's userId first and filters on it. Callers get
// that id from requireUser() in src/lib/dal.ts, never from client input.

export type TransactionFilters = {
  /** Text search in the description. */
  q?: string;
  /** "YYYY-MM" */
  month?: string;
  /** A category id, or "none" for uncategorized. */
  categoryId?: string;
  bankAccountId?: string;
};

function filterConditions(userId: string, filters: TransactionFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [eq(transactions.userId, userId)];

  if (filters.q) {
    conditions.push(ilike(transactions.description, `%${escapeLike(filters.q)}%`));
  }
  if (filters.month) {
    const { start, end } = monthRange(filters.month);
    conditions.push(gte(transactions.occurredAt, start), lt(transactions.occurredAt, end));
  }
  if (filters.categoryId === "none") {
    conditions.push(isNull(transactions.categoryId));
  } else if (filters.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }
  if (filters.bankAccountId) {
    conditions.push(eq(transactions.bankAccountId, filters.bankAccountId));
  }
  return and(...conditions);
}

export async function listTransactions(
  userId: string,
  filters: TransactionFilters = {},
  { page = 1, pageSize = 25 }: { page?: number; pageSize?: number } = {},
) {
  const where = filterConditions(userId, filters);

  const [rows, [{ total }]] = await Promise.all([
    db
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
      .where(where)
      .orderBy(
        desc(transactions.occurredAt),
        desc(transactions.occurredTime),
        desc(transactions.createdAt),
        desc(transactions.id),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(transactions).where(where),
  ]);

  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export type TransactionRow = Awaited<ReturnType<typeof listTransactions>>["rows"][number];
