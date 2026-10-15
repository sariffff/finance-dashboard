import { describe, expect, it } from "vitest";

import { findMatchingRule, kindForDirection, sortRules, type MatchableRule } from "@/lib/categorize/rules";

import { generateDemoTransactions } from "./demo-data";
import { defaultCategories, systemRules } from "./seed-data";

const options = { endMonth: "2026-10", months: 12, today: "2026-10-15" };
const rows = generateDemoTransactions(options);

const kindByName = new Map(defaultCategories.map((c) => [c.name, c.kind]));
const rules: MatchableRule[] = sortRules(
  systemRules.map(({ pattern, category }, index) => ({
    id: String(index),
    pattern,
    matchType: "contains" as const,
    source: "system" as const,
    priority: 0,
    categoryId: category,
    categoryKind: kindByName.get(category)!,
  })),
);

describe("generateDemoTransactions", () => {
  it("is deterministic", () => {
    expect(generateDemoTransactions(options)).toEqual(rows);
  });

  it("keeps a month the same when 'today' moves on", () => {
    const later = generateDemoTransactions({ endMonth: "2026-11", months: 12, today: "2026-11-30" });
    const september = (list: typeof rows) => list.filter((row) => row.occurredAt.startsWith("2026-09"));
    expect(september(later)).toEqual(september(rows));
  });

  it("covers 12 months and nothing after today", () => {
    const months = new Set(rows.map((row) => row.occurredAt.slice(0, 7)));
    expect([...months]).toHaveLength(12);
    expect([...months].sort()[0]).toBe("2025-11");
    expect(rows.every((row) => row.occurredAt <= options.today)).toBe(true);
  });

  it("has valid dates, times and positive whole-satang amounts", () => {
    for (const row of rows) {
      expect(Number.isNaN(Date.parse(row.occurredAt))).toBe(false);
      expect(row.occurredTime).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(Number.isInteger(row.amountSatang)).toBe(true);
      expect(row.amountSatang).toBeGreaterThan(0);
    }
  });

  it("pays a salary every complete month, with a raise in January", () => {
    const salaries = rows.filter((row) => row.description.startsWith("เงินเดือน"));
    expect(salaries).toHaveLength(11); // October's payday (25th) is after "today"
    expect(salaries[0].amountSatang).toBeLessThan(salaries.at(-1)!.amountSatang);
  });

  it("only answers with existing categories of the right kind", () => {
    for (const row of rows.filter((r) => r.ai)) {
      expect(kindByName.get(row.ai!.categoryName)).toBe(kindForDirection(row.direction));
    }
  });

  it("leaves only a few deliberate rows for nobody to categorize", () => {
    const unhandled = rows.filter((row) => !row.ai && !findMatchingRule(row.description, row.direction, rules));
    expect(unhandled.length).toBeGreaterThan(0);
    expect(unhandled.length).toBeLessThanOrEqual(3);
    expect(unhandled.every((row) => row.occurredAt.startsWith("2026-10"))).toBe(true);
  });
});
