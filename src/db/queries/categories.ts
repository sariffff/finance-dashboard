import { and, asc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, categoryRules, transactions, type Category } from "@/db/schema";
import { normalizeForMatch, type MatchableRule } from "@/lib/categorize/rules";

// Every query takes the owner's userId first and filters on it. Built-in
// categories and system rules (userId = null) are visible to everyone.

const visibleTo = (userId: string) =>
  or(isNull(categories.userId), eq(categories.userId, userId));

export function listCategoriesForUser(userId: string): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(visibleTo(userId))
    .orderBy(asc(categories.kind), asc(categories.name));
}

export function listRulesForUser(userId: string): Promise<MatchableRule[]> {
  return db
    .select({
      id: categoryRules.id,
      pattern: categoryRules.pattern,
      matchType: categoryRules.matchType,
      source: categoryRules.source,
      priority: categoryRules.priority,
      categoryId: categoryRules.categoryId,
      categoryKind: categories.kind,
    })
    .from(categoryRules)
    .innerJoin(categories, eq(categories.id, categoryRules.categoryId))
    .where(or(isNull(categoryRules.userId), eq(categoryRules.userId, userId)));
}

export function listUncategorizedTransactions(userId: string, importId?: string) {
  return db
    .select({
      id: transactions.id,
      description: transactions.description,
      direction: transactions.direction,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.categoryId),
        importId ? eq(transactions.importId, importId) : undefined,
      ),
    );
}

export type CategoryAssignment = {
  transactionId: string;
  categoryId: string;
  source: "rule" | "ai";
  merchant: string | null;
};

/** Apply automatic categories, never overriding a choice the user made. */
export async function assignCategories(
  userId: string,
  assignments: CategoryAssignment[],
): Promise<void> {
  // One UPDATE per distinct (category, source, merchant) instead of per row.
  const groups = new Map<string, { assignment: CategoryAssignment; ids: string[] }>();
  for (const assignment of assignments) {
    const key = `${assignment.categoryId}|${assignment.source}|${assignment.merchant ?? ""}`;
    const group = groups.get(key) ?? { assignment, ids: [] };
    group.ids.push(assignment.transactionId);
    groups.set(key, group);
  }

  for (const { assignment, ids } of groups.values()) {
    await db
      .update(transactions)
      .set({
        categoryId: assignment.categoryId,
        categorySource: assignment.source,
        merchant: assignment.merchant ?? undefined,
      })
      .where(
        and(
          eq(transactions.userId, userId),
          inArray(transactions.id, ids),
          or(isNull(transactions.categorySource), ne(transactions.categorySource, "user")),
        ),
      );
  }
}

/** Remember AI answers per merchant so the same shop never needs AI again. */
export async function saveAiCacheRules(
  userId: string,
  entries: { merchant: string; categoryId: string }[],
): Promise<void> {
  if (entries.length === 0) return;
  await db
    .insert(categoryRules)
    .values(
      entries.map(({ merchant, categoryId }) => ({
        userId,
        pattern: normalizeForMatch(merchant),
        matchType: "contains" as const,
        categoryId,
        source: "ai_cache" as const,
      })),
    )
    .onConflictDoNothing();
}

async function isCategoryVisible(userId: string, categoryId: string) {
  const [found] = await db
    .select({ kind: categories.kind })
    .from(categories)
    .where(and(eq(categories.id, categoryId), visibleTo(userId)));
  return found;
}

/**
 * The user picked a category by hand. Returns the updated transaction, or
 * undefined when the transaction or category isn't theirs / doesn't fit.
 */
export async function setTransactionCategory(
  userId: string,
  transactionId: string,
  categoryId: string,
) {
  const category = await isCategoryVisible(userId, categoryId);
  if (!category) return undefined;

  const [updated] = await db
    .update(transactions)
    .set({ categoryId, categorySource: "user" })
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.id, transactionId),
        // The category must fit the money's direction.
        eq(transactions.direction, category.kind === "income" ? "in" : "out"),
      ),
    )
    .returning();
  return updated;
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * "Use this category for this shop every time": save a user rule (replacing
 * any cached AI rule for the same text) and re-categorize the user's
 * existing matching transactions that they haven't categorized by hand.
 * Returns how many other transactions changed.
 */
export async function createUserRule(
  userId: string,
  pattern: string,
  categoryId: string,
): Promise<number | undefined> {
  const category = await isCategoryVisible(userId, categoryId);
  const normalized = normalizeForMatch(pattern);
  if (!category || normalized.length === 0) return undefined;

  await db
    .insert(categoryRules)
    .values({ userId, pattern: normalized, matchType: "contains", categoryId, source: "user" })
    .onConflictDoUpdate({
      target: [categoryRules.userId, categoryRules.pattern, categoryRules.matchType],
      set: { categoryId, source: "user" },
    });

  const updated = await db
    .update(transactions)
    .set({ categoryId, categorySource: "rule" })
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.direction, category.kind === "income" ? "in" : "out"),
        or(isNull(transactions.categorySource), ne(transactions.categorySource, "user")),
        sql`${transactions.description} ilike ${`%${escapeLike(normalized)}%`}`,
      ),
    )
    .returning({ id: transactions.id });
  return updated.length;
}
