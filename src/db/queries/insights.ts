import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { monthlyInsights } from "@/db/schema";

// Every query takes the owner's userId first and filters on it.

export async function getInsight(userId: string, month: string) {
  const [found] = await db
    .select()
    .from(monthlyInsights)
    .where(and(eq(monthlyInsights.userId, userId), eq(monthlyInsights.month, month)));
  return found;
}

export async function saveInsight(
  userId: string,
  month: string,
  insight: { bullets: string[]; inputHash: string; model: string },
): Promise<void> {
  await db
    .insert(monthlyInsights)
    .values({ userId, month, ...insight })
    .onConflictDoUpdate({
      target: [monthlyInsights.userId, monthlyInsights.month],
      set: { ...insight, createdAt: new Date() },
    });
}
