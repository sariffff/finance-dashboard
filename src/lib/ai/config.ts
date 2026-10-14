import { env } from "@/env";

import type { AiTask, ClaudeModel } from "./models";

/** True when an API key is configured; otherwise AI features fall back to rules. */
export function isAiConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/** The model for a task: its own AI_MODEL_<TASK> setting, else AI_MODEL. */
export function modelFor(task: AiTask): ClaudeModel {
  const perTask = {
    categorize: env.AI_MODEL_CATEGORIZE,
    slip: env.AI_MODEL_SLIP,
    insights: env.AI_MODEL_INSIGHTS,
  }[task];
  return perTask ?? env.AI_MODEL;
}
