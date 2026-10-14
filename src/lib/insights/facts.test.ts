import { describe, expect, it } from "vitest";

import { formatBahtNumber } from "@/lib/money";

import {
  buildFallbackBullets,
  buildInsightFacts,
  keepGroundedBullets,
  percentChange,
  type InsightFacts,
} from "./facts";

const facts: InsightFacts = buildInsightFacts({
  monthLabel: "กันยายน 2569",
  previousMonthLabel: "สิงหาคม 2569",
  current: { inSatang: 3_500_000, outSatang: 2_000_000 },
  previous: { inSatang: 3_500_000, outSatang: 1_600_000 },
  spending: [
    { categoryId: "a", name: "อาหารและเครื่องดื่ม", totalSatang: 1_000_000, count: 30 },
    { categoryId: null, name: null, totalSatang: 600_000, count: 10 },
    { categoryId: "b", name: "เดินทาง", totalSatang: 400_000, count: 12 },
  ],
  previousSpending: [
    { categoryId: "a", name: "อาหารและเครื่องดื่ม", totalSatang: 800_000, count: 25 },
    { categoryId: "b", name: "เดินทาง", totalSatang: 500_000, count: 14 },
  ],
});

describe("buildInsightFacts", () => {
  it("computes totals, changes and shares in code", () => {
    expect(facts).toEqual({
      month: "กันยายน 2569",
      previousMonth: "สิงหาคม 2569",
      income: "35,000.00",
      expense: "20,000.00",
      net: "15,000.00",
      previousExpense: "16,000.00",
      expenseChangePercent: 25,
      topCategories: [
        { name: "อาหารและเครื่องดื่ม", amount: "10,000.00", sharePercent: 50, previousAmount: "8,000.00", changePercent: 25 },
        { name: "เดินทาง", amount: "4,000.00", sharePercent: 20, previousAmount: "5,000.00", changePercent: -20 },
      ],
      uncategorized: { amount: "6,000.00", sharePercent: 30 },
    });
  });

  it("has nothing to compare against an empty previous month", () => {
    expect(percentChange(500, 0)).toBeNull();
  });
});

describe("buildFallbackBullets", () => {
  it("summarizes the facts in Thai without AI", () => {
    expect(buildFallbackBullets(facts)).toEqual([
      "รายจ่ายกันยายน 2569 ฿20,000.00 มากกว่าสิงหาคม 2569 25%",
      "หมวดที่ใช้มากที่สุดคืออาหารและเครื่องดื่ม ฿10,000.00 (50% ของรายจ่าย)",
      "อาหารและเครื่องดื่มเพิ่มขึ้น 25% จากสิงหาคม 2569",
      "เหลือเก็บ ฿15,000.00 จากรายรับ ฿35,000.00",
      "ยังมีรายจ่าย 30% ที่ยังไม่จัดหมวด",
    ]);
  });

  it("says so when spending is above income", () => {
    const overspent = { ...facts, net: "-1,250.75" };
    expect(buildFallbackBullets(overspent)).toContain("ใช้จ่ายเกินรายรับ ฿1,250.75");
  });

  it("only uses grounded numbers itself", () => {
    const bullets = buildFallbackBullets(facts);
    expect(keepGroundedBullets(bullets, facts)).toEqual(bullets);
  });
});

describe("keepGroundedBullets", () => {
  it("drops sentences with numbers that aren't in the facts", () => {
    expect(
      keepGroundedBullets(
        [
          "เดือนนี้ใช้จ่าย ฿20,000.00 เพิ่มขึ้น 25%", // grounded
          "ค่าอาหารประมาณ ฿10,000", // rounded: 10000 isn't a fact
          "ค่าเดินทางลดลง 21%", // miscalculated
          "ลองจัดหมวดรายการที่เหลือดูนะ", // no numbers at all
        ],
        facts,
      ),
    ).toEqual(["เดือนนี้ใช้จ่าย ฿20,000.00 เพิ่มขึ้น 25%", "ลองจัดหมวดรายการที่เหลือดูนะ"]);
  });
});

describe("formatBahtNumber", () => {
  it.each([
    [0, "0.00"],
    [5, "0.05"],
    [123_456_789, "1,234,567.89"],
    [-125_075, "-1,250.75"],
  ])("formats %d satang as %j", (satang, expected) => {
    expect(formatBahtNumber(satang)).toBe(expected);
  });
});
