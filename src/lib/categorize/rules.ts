import { normalizeThai } from "@/lib/thai";

export type CategoryKind = "income" | "expense";

export type MatchableRule = {
  id: string;
  pattern: string;
  matchType: "contains" | "regex";
  source: "system" | "user" | "ai_cache";
  priority: number;
  categoryId: string;
  categoryKind: CategoryKind;
};

// The user's own rules win over cached AI answers, which win over the
// built-in system rules.
const SOURCE_RANK: Record<MatchableRule["source"], number> = {
  user: 0,
  ai_cache: 1,
  system: 2,
};

/** Lowercased, Thai-normalized text used on both sides of a match. */
export function normalizeForMatch(text: string): string {
  return normalizeThai(text).toLowerCase();
}

export function kindForDirection(direction: "in" | "out"): CategoryKind {
  return direction === "in" ? "income" : "expense";
}

/** Order rules so the first match is the one that should win. */
export function sortRules<T extends MatchableRule>(rules: T[]): T[] {
  return [...rules].sort(
    (a, b) =>
      SOURCE_RANK[a.source] - SOURCE_RANK[b.source] ||
      b.priority - a.priority ||
      // More specific (longer) patterns before generic ones.
      b.pattern.length - a.pattern.length,
  );
}

function matches(rule: MatchableRule, normalizedDescription: string): boolean {
  if (rule.matchType === "contains") {
    return normalizedDescription.includes(normalizeForMatch(rule.pattern));
  }
  try {
    return new RegExp(rule.pattern, "i").test(normalizedDescription);
  } catch {
    return false; // an invalid pattern never matches rather than crashing an import
  }
}

/**
 * First rule (from `sortRules` order) that matches the description and
 * whose category fits the money's direction: an incoming transfer never
 * lands in an expense category and vice versa.
 */
export function findMatchingRule<T extends MatchableRule>(
  description: string,
  direction: "in" | "out",
  sortedRules: T[],
): T | undefined {
  const normalized = normalizeForMatch(description);
  const kind = kindForDirection(direction);
  return sortedRules.find(
    (rule) => rule.categoryKind === kind && matches(rule, normalized),
  );
}
