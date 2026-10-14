import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { parseAmountToSatang } from "@/lib/money";
import { addMonths, monthRange } from "@/lib/month";

// Dashboard aggregates. Every number is summed in SQL (GROUP BY) and every
// query takes the owner's userId first. Sums come back from PostgreSQL as
// numeric strings and are converted to integer satang, never floats.

const toSatang = (value: string | null) => (value ? parseAmountToSatang(value) : 0);

function inMonth(month: string) {
  const { start, end } = monthRange(month);
  return and(gte(transactions.occurredAt, start), lt(transactions.occurredAt, end));
}

export type MonthTotals = { inSatang: number; outSatang: number };

export async function getMonthTotals(userId: string, month: string): Promise<MonthTotals> {
  const rows = await db
    .select({
      direction: transactions.direction,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inMonth(month)))
    .groupBy(transactions.direction);

  return {
    inSatang: toSatang(rows.find((row) => row.direction === "in")?.total ?? null),
    outSatang: toSatang(rows.find((row) => row.direction === "out")?.total ?? null),
  };
}

export type CategorySpending = {
  categoryId: string | null;
  /** null = ยังไม่จัดหมวด */
  name: string | null;
  totalSatang: number;
  count: number;
};

export async function getSpendingByCategory(
  userId: string,
  month: string,
): Promise<CategorySpending[]> {
  const total = sql<string>`sum(${transactions.amount})`;
  const rows = await db
    .select({
      categoryId: categories.id,
      name: categories.name,
      total,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(eq(transactions.userId, userId), eq(transactions.direction, "out"), inMonth(month)))
    .groupBy(categories.id, categories.name)
    .orderBy(desc(total));

  return rows.map((row) => ({
    categoryId: row.categoryId,
    name: row.name,
    totalSatang: toSatang(row.total),
    count: row.count,
  }));
}

export type MonthlyTotals = MonthTotals & { month: string };

/** Income and spending for `count` months ending at `lastMonth`, empty months as 0. */
export async function getMonthlyTotals(
  userId: string,
  lastMonth: string,
  count: number,
): Promise<MonthlyTotals[]> {
  const firstMonth = addMonths(lastMonth, -(count - 1));
  const rows = await db.execute<{ month: string; total_in: string | null; total_out: string | null }>(sql`
    with sums as (
      select
        date_trunc('month', ${transactions.occurredAt})::date as month,
        sum(${transactions.amount}) filter (where ${transactions.direction} = 'in') as total_in,
        sum(${transactions.amount}) filter (where ${transactions.direction} = 'out') as total_out
      from ${transactions}
      where ${transactions.userId} = ${userId}
        and ${transactions.occurredAt} >= ${monthRange(firstMonth).start}
        and ${transactions.occurredAt} < ${monthRange(lastMonth).end}
      group by 1
    )
    select to_char(series.month, 'YYYY-MM') as month, sums.total_in, sums.total_out
    from generate_series(${`${firstMonth}-01`}::date, ${`${lastMonth}-01`}::date, interval '1 month') as series(month)
    left join sums on sums.month = series.month
    order by series.month
  `);

  return [...rows].map((row) => ({
    month: row.month,
    inSatang: toSatang(row.total_in),
    outSatang: toSatang(row.total_out),
  }));
}

/** Months that have at least one transaction, newest first. */
export async function listActiveMonths(userId: string): Promise<string[]> {
  const month = sql<string>`to_char(${transactions.occurredAt}, 'YYYY-MM')`;
  const rows = await db
    .selectDistinct({ month })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(month));
  return rows.map((row) => row.month);
}
