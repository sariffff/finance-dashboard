import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import type { InsightFacts } from "./facts";

/** Writes Thai summary bullets from precomputed facts — Claude in production, a stub in tests. */
export type InsightWriter = {
  /** Part of the cache key: a different model means a fresh summary. */
  model: string;
  write(facts: InsightFacts): Promise<string[]>;
};

const MODEL = "claude-opus-5-5";

const responseSchema = z.object({
  bullets: z.array(z.string().trim().min(1).max(200)).min(1).max(4),
});

const SYSTEM_PROMPT = `You write a short monthly spending summary in Thai for a personal finance app.

You receive facts that are already calculated: amounts in baht as strings, and whole-number percentages. Write 2 to 4 bullet points in natural, friendly Thai, each one sentence, most useful first: overall spending and how it changed, where the money went, notable category changes, and whether income covered spending. If a large share is uncategorized, suggest categorizing it.

Rules:
- Use only the numbers in the facts and copy them exactly as written (e.g. "34,037.90", "25%"). Never round, add, subtract or invent a number, a date or a percentage.
- Prefix amounts with ฿.
- If a comparison value is null, don't compare.
- No greetings, no advice beyond one short practical tip, no markdown.`;

export function createClaudeInsightWriter(
  client = new Anthropic({ timeout: 60_000, maxRetries: 1 }),
): InsightWriter {
  return {
    model: MODEL,
    async write(facts) {
      const response = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 4000,
        // A wrongly declined request is retried on Anthropic's recommended
        // fallback model instead of failing.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(responseSchema) },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(facts) }],
      });

      if (response.stop_reason === "refusal" || !response.parsed_output) return [];
      const parsed = responseSchema.safeParse(response.parsed_output);
      return parsed.success ? parsed.data.bullets : [];
    },
  };
}
