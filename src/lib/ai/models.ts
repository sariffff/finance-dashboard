// Claude models this app can be configured to use (AI_MODEL in .env).
// Opus is the most capable; Haiku is ~40x cheaper and fine for short
// classification and summaries.
export const CLAUDE_MODELS = [
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "claude-haiku-5-5",
  "claude-fable-5-1",
] as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[number];

export const DEFAULT_MODEL: ClaudeModel = "claude-opus-5-5";

export type AiTask = "categorize" | "slip" | "insights";

// Models that accept the server-side `fallbacks: "default"` parameter: when
// a safety classifier wrongly declines a request, the API re-runs it on
// Anthropic's recommended fallback model instead of failing it.
const SERVER_FALLBACK_MODELS = new Set<ClaudeModel>([
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "claude-fable-5-1",
]);

/** Extra request params enabling the refusal fallback where the model supports it. */
export function refusalFallbackParams(model: ClaudeModel) {
  return SERVER_FALLBACK_MODELS.has(model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
}
