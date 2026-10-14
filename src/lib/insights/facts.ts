import type { CategorySpending, MonthTotals } from "@/db/queries/dashboard";
import { formatBahtNumber } from "@/lib/money";

// Everything numeric in an insight is computed here, in code, from the SQL
// aggregates. The AI only turns these facts into Thai sentences; it never
// sees individual transactions and never does arithmetic.

export type CategoryFact = {
  name: string;
  amount: string;
  sharePercent: number;
  previousAmount: string | null;
  changePercent: number | null;
};

export type InsightFacts = {
  month: string;
  previousMonth: string;
  income: string;
  expense: string;
  /** Income minus spending; starts with "-" when spending was higher. */
  net: string;
  previousExpense: string | null;
  expenseChangePercent: number | null;
  topCategories: CategoryFact[];
  uncategorized: { amount: string; sharePercent: number } | null;
};

const TOP_CATEGORIES = 5;

/** Whole-number % change, or null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function share(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export function buildInsightFacts(input: {
  monthLabel: string;
  previousMonthLabel: string;
  current: MonthTotals;
  previous: MonthTotals;
  spending: CategorySpending[];
  previousSpending: CategorySpending[];
}): InsightFacts {
  const { current, previous } = input;
  const previousByName = new Map(
    input.previousSpending.filter((row) => row.name).map((row) => [row.name, row.totalSatang]),
  );
  const uncategorized = input.spending.find((row) => row.name === null);

  return {
    month: input.monthLabel,
    previousMonth: input.previousMonthLabel,
    income: formatBahtNumber(current.inSatang),
    expense: formatBahtNumber(current.outSatang),
    net: formatBahtNumber(current.inSatang - current.outSatang),
    previousExpense: previous.outSatang > 0 ? formatBahtNumber(previous.outSatang) : null,
    expenseChangePercent: percentChange(current.outSatang, previous.outSatang),
    topCategories: input.spending
      .filter((row): row is CategorySpending & { name: string } => row.name !== null)
      .slice(0, TOP_CATEGORIES)
      .map((row) => {
        const before = previousByName.get(row.name) ?? 0;
        return {
          name: row.name,
          amount: formatBahtNumber(row.totalSatang),
          sharePercent: share(row.totalSatang, current.outSatang),
          previousAmount: before > 0 ? formatBahtNumber(before) : null,
          changePercent: percentChange(row.totalSatang, before),
        };
      }),
    uncategorized: uncategorized
      ? {
          amount: formatBahtNumber(uncategorized.totalSatang),
          sharePercent: share(uncategorized.totalSatang, current.outSatang),
        }
      : null,
  };
}

/** Plain summary from the facts alone: used without an API key or when the AI fails. */
export function buildFallbackBullets(facts: InsightFacts): string[] {
  const bullets: string[] = [];

  let spending = `รายจ่าย${facts.month} ฿${facts.expense}`;
  if (facts.expenseChangePercent !== null && facts.expenseChangePercent !== 0) {
    const direction = facts.expenseChangePercent > 0 ? "มากกว่า" : "น้อยกว่า";
    spending += ` ${direction}${facts.previousMonth} ${Math.abs(facts.expenseChangePercent)}%`;
  }
  bullets.push(spending);

  const [top] = facts.topCategories;
  if (top) {
    bullets.push(`หมวดที่ใช้มากที่สุดคือ${top.name} ฿${top.amount} (${top.sharePercent}% ของรายจ่าย)`);
  }

  const biggestRise = facts.topCategories
    .filter((c) => c.changePercent !== null && c.changePercent > 0)
    .sort((a, b) => b.changePercent! - a.changePercent!)[0];
  if (biggestRise) {
    bullets.push(`${biggestRise.name}เพิ่มขึ้น ${biggestRise.changePercent}% จาก${facts.previousMonth}`);
  }

  if (facts.net.startsWith("-")) {
    bullets.push(`ใช้จ่ายเกินรายรับ ฿${facts.net.slice(1)}`);
  } else {
    bullets.push(`เหลือเก็บ ฿${facts.net} จากรายรับ ฿${facts.income}`);
  }

  if (facts.uncategorized && facts.uncategorized.sharePercent >= 20) {
    bullets.push(`ยังมีรายจ่าย ${facts.uncategorized.sharePercent}% ที่ยังไม่จัดหมวด`);
  }
  return bullets;
}

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const normalizeNumber = (token: string) => token.replace(/,/g, "");

/**
 * Keep only bullets whose every number appears in the facts, so a sentence
 * with a miscalculated or invented figure never reaches the user.
 */
export function keepGroundedBullets(bullets: string[], facts: InsightFacts): string[] {
  const allowed = new Set((JSON.stringify(facts).match(NUMBER) ?? []).map(normalizeNumber));
  return bullets.filter((bullet) =>
    (bullet.match(NUMBER) ?? []).every((token) => allowed.has(normalizeNumber(token))),
  );
}
