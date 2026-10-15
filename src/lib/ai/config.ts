import { env } from "@/env";

import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_MODEL,
  providerOf,
  type AiModel,
  type AiProvider,
  type AiTask,
} from "./models";

function hasKey(provider: AiProvider): boolean {
  return Boolean(provider === "gemini" ? env.GEMINI_API_KEY : env.ANTHROPIC_API_KEY);
}

/**
 * The model for a task: its own AI_MODEL_<TASK> setting, else AI_MODEL,
 * else the default of whichever provider has a key (Claude when both do).
 */
export function modelFor(task: AiTask): AiModel {
  const perTask = {
    categorize: env.AI_MODEL_CATEGORIZE,
    slip: env.AI_MODEL_SLIP,
    insights: env.AI_MODEL_INSIGHTS,
  }[task];
  const chosen = perTask ?? env.AI_MODEL;
  if (chosen) return chosen;
  return !hasKey("anthropic") && hasKey("gemini") ? DEFAULT_GEMINI_MODEL : DEFAULT_MODEL;
}

/**
 * True when the task's model has its provider's API key; otherwise that AI
 * feature falls back to rules (or manual entry, for slips).
 */
export function isAiConfigured(task: AiTask): boolean {
  return hasKey(providerOf(modelFor(task)));
}
