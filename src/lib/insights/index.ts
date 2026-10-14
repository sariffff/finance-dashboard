import { createHash } from "node:crypto";

import { getMonthTotals, getSpendingByCategory } from "@/db/queries/dashboard";
import { getInsight, saveInsight } from "@/db/queries/insights";
import { env } from "@/env";
import { addMonths, formatMonth } from "@/lib/month";

import { createClaudeInsightWriter, type InsightWriter } from "./ai";
import { buildFallbackBullets, buildInsightFacts, keepGroundedBullets, type InsightFacts } from "./facts";

export type MonthlyInsight = { bullets: string[]; source: "ai" | "rules" };

// Bump when the prompt or facts shape changes, so cached text is rewritten.
const PROMPT_VERSION = 1;

/** Claude when an API key is configured, otherwise rule-based summaries only. */
export function getDefaultInsightWriter(): InsightWriter | null {
  return env.ANTHROPIC_API_KEY ? createClaudeInsightWriter() : null;
}

async function loadFacts(userId: string, month: string): Promise<InsightFacts | null> {
  const previousMonth = addMonths(month, -1);
  const [current, previous, spending, previousSpending] = await Promise.all([
    getMonthTotals(userId, month),
    getMonthTotals(userId, previousMonth),
    getSpendingByCategory(userId, month),
    getSpendingByCategory(userId, previousMonth),
  ]);
  if (current.inSatang === 0 && current.outSatang === 0) return null;

  return buildInsightFacts({
    monthLabel: formatMonth(month),
    previousMonthLabel: formatMonth(previousMonth),
    current,
    previous,
    spending,
    previousSpending,
  });
}

/**
 * The month's summary. AI text is cached per month and reused until the
 * month's numbers change; without a writer, or if the AI fails or writes
 * nothing usable, a rule-based summary is returned (and not cached).
 */
export async function getMonthlyInsight(
  userId: string,
  month: string,
  writer: InsightWriter | null,
): Promise<MonthlyInsight | null> {
  const facts = await loadFacts(userId, month);
  if (!facts) return null;

  if (writer) {
    const inputHash = createHash("sha256")
      .update(JSON.stringify({ version: PROMPT_VERSION, model: writer.model, facts }))
      .digest("hex");

    const cached = await getInsight(userId, month);
    if (cached?.inputHash === inputHash) return { bullets: cached.bullets, source: "ai" };

    try {
      const bullets = keepGroundedBullets(await writer.write(facts), facts);
      if (bullets.length > 0) {
        await saveInsight(userId, month, { bullets, inputHash, model: writer.model });
        return { bullets, source: "ai" };
      }
    } catch (error) {
      console.error("AI insight failed", error);
    }
  }

  return { bullets: buildFallbackBullets(facts), source: "rules" };
}
