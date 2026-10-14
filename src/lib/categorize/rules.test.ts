import { describe, expect, it } from "vitest";

import { findMatchingRule, sortRules, type MatchableRule } from "./rules";

function rule(overrides: Partial<MatchableRule> & Pick<MatchableRule, "pattern" | "categoryId">): MatchableRule {
  return {
    id: overrides.pattern,
    matchType: "contains",
    source: "system",
    priority: 0,
    categoryKind: "expense",
    ...overrides,
  };
}

describe("findMatchingRule", () => {
  it("matches case-insensitively inside the description", () => {
    const rules = sortRules([rule({ pattern: "grab", categoryId: "travel" })]);
    expect(findMatchingRule("GRAB* A-ABC123 ค่าเดินทาง", "out", rules)?.categoryId).toBe("travel");
    expect(findMatchingRule("ร้านกาแฟ", "out", rules)).toBeUndefined();
  });

  it("prefers user rules, then cached AI answers, then system rules", () => {
    const rules = sortRules([
      rule({ pattern: "7-eleven", categoryId: "system", source: "system" }),
      rule({ pattern: "7-eleven", categoryId: "ai", source: "ai_cache" }),
      rule({ pattern: "7-eleven", categoryId: "user", source: "user" }),
    ]);
    expect(findMatchingRule("จ่ายบิล 7-ELEVEN", "out", rules)?.categoryId).toBe("user");
    expect(findMatchingRule("จ่ายบิล 7-ELEVEN", "out", rules.slice(1))?.categoryId).toBe("ai");
  });

  it("prefers the more specific pattern at the same level", () => {
    const rules = sortRules([
      rule({ pattern: "grab", categoryId: "travel" }),
      rule({ pattern: "grab food", categoryId: "food" }),
    ]);
    expect(findMatchingRule("GRAB FOOD ข้าวมันไก่", "out", rules)?.categoryId).toBe("food");
  });

  it("only uses categories that fit the money's direction", () => {
    const rules = sortRules([
      rule({ pattern: "เงินเดือน", categoryId: "salary", categoryKind: "income" }),
    ]);
    expect(findMatchingRule("เงินเดือน บริษัท", "in", rules)?.categoryId).toBe("salary");
    expect(findMatchingRule("โอนคืนเงินเดือน", "out", rules)).toBeUndefined();
  });

  it("matches Thai text even when the PDF split SARA AM", () => {
    const rules = sortRules([rule({ pattern: "การประปา", categoryId: "bills" })]);
    const mangled = `ชำระค่าน้${String.fromCodePoint(0x0e33, 0x0e32)}ประปา การประปานครหลวง`;
    expect(findMatchingRule(mangled, "out", rules)?.categoryId).toBe("bills");
  });

  it("treats an invalid regex as no match instead of crashing", () => {
    const rules = sortRules([rule({ pattern: "([", matchType: "regex", categoryId: "x" })]);
    expect(findMatchingRule("anything", "out", rules)).toBeUndefined();
  });
});
