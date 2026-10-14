import {
  assignCategories,
  listCategoriesForUser,
  listRulesForUser,
  listUncategorizedTransactions,
  saveAiCacheRules,
  type CategoryAssignment,
} from "@/db/queries/categories";
import { env } from "@/env";

import { createClaudeCategorizer, type AiCategorizer } from "./ai";
import { findMatchingRule, kindForDirection, normalizeForMatch, sortRules } from "./rules";

export type CategorizeStats = {
  byRule: number;
  byAi: number;
  uncategorized: number;
  /** AI was configured but the call failed; rows stay uncategorized. */
  aiFailed: boolean;
};

/** Claude when an API key is configured, otherwise rules only. */
export function getDefaultCategorizer(): AiCategorizer | null {
  return env.ANTHROPIC_API_KEY ? createClaudeCategorizer() : null;
}

/**
 * Categorize a user's uncategorized transactions (optionally just one
 * import) in three steps:
 *   1. rules — the user's own, then cached AI answers, then system rules;
 *   2. AI — the rest in batches, one request per distinct description;
 *   3. cache — each AI answer with a merchant becomes an `ai_cache` rule, so
 *      that merchant is handled by step 1 next time.
 * Never throws because of the AI: on failure the rows stay uncategorized.
 */
export async function categorizeUncategorized(
  userId: string,
  { importId, categorizer }: { importId?: string; categorizer: AiCategorizer | null },
): Promise<CategorizeStats> {
  const [pending, rules] = await Promise.all([
    listUncategorizedTransactions(userId, importId),
    listRulesForUser(userId),
  ]);
  const sortedRules = sortRules(rules);

  const assignments: CategoryAssignment[] = [];
  const leftover: typeof pending = [];
  for (const tx of pending) {
    const rule = findMatchingRule(tx.description, tx.direction, sortedRules);
    if (rule) {
      assignments.push({ transactionId: tx.id, categoryId: rule.categoryId, source: "rule", merchant: null });
    } else {
      leftover.push(tx);
    }
  }
  const byRule = assignments.length;

  let byAi = 0;
  let aiFailed = false;
  if (categorizer && leftover.length > 0) {
    // Ask once per distinct description (e.g. the same café every morning).
    const groups = new Map<string, typeof leftover>();
    for (const tx of leftover) {
      const key = `${tx.direction}|${normalizeForMatch(tx.description)}`;
      groups.set(key, [...(groups.get(key) ?? []), tx]);
    }
    const representatives = [...groups.values()].map((group) => group[0]);

    try {
      const categories = await listCategoriesForUser(userId);
      const results = await categorizer(
        representatives.map((tx, id) => ({ id, description: tx.description, direction: tx.direction })),
        categories.map((c) => ({ name: c.name, kind: c.kind })),
      );

      const cacheEntries = new Map<string, { merchant: string; categoryId: string }>();
      for (const result of results) {
        const representative = representatives[result.id];
        const category = categories.find(
          (c) => c.name === result.categoryName && c.kind === kindForDirection(representative.direction),
        );
        if (!category) continue;

        const group = groups.get(`${representative.direction}|${normalizeForMatch(representative.description)}`)!;
        for (const tx of group) {
          assignments.push({ transactionId: tx.id, categoryId: category.id, source: "ai", merchant: result.merchant });
        }
        byAi += group.length;
        if (result.merchant) {
          cacheEntries.set(normalizeForMatch(result.merchant), { merchant: result.merchant, categoryId: category.id });
        }
      }
      await saveAiCacheRules(userId, [...cacheEntries.values()]);
    } catch (error) {
      // Timeouts, rate limits, outages: log and carry on without AI.
      console.error("AI categorization failed", error);
      aiFailed = true;
    }
  }

  await assignCategories(userId, assignments);
  return { byRule, byAi, uncategorized: pending.length - byRule - byAi, aiFailed };
}
