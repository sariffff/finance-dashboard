// Models this app can be configured to use (AI_MODEL / AI_MODEL_<TASK> in
// .env). The provider follows from the name: claude-* → Anthropic
// (ANTHROPIC_API_KEY), gemini-* → Google (GEMINI_API_KEY).

// Opus is the most capable; Haiku is ~40x cheaper and fine for short
// classification and summaries.
export const CLAUDE_MODELS = [
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "claude-haiku-5-5",
  "claude-fable-5-1",
] as const;

// Stable (non-preview) Gemini models with JSON-schema output and image
// input, checked against the live API (2026-10). Flash-Lite is the fastest
// and cheapest; 3.8 Flash is the newest but was often at capacity (503) when
// tested, so 3.5 Flash is the default. Gemini 2.5 is closed to new API keys.
export const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
] as const;

export const AI_MODELS = [...CLAUDE_MODELS, ...GEMINI_MODELS] as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[number];
export type GeminiModel = (typeof GEMINI_MODELS)[number];
export type AiModel = (typeof AI_MODELS)[number];
export type AiProvider = "anthropic" | "gemini";

export const DEFAULT_MODEL: ClaudeModel = "claude-opus-5-5";
export const DEFAULT_GEMINI_MODEL: GeminiModel = "gemini-3.5-flash";

export type AiTask = "categorize" | "slip" | "insights";

export function isGeminiModel(model: AiModel): model is GeminiModel {
  return (GEMINI_MODELS as readonly string[]).includes(model);
}

export function providerOf(model: AiModel): AiProvider {
  return isGeminiModel(model) ? "gemini" : "anthropic";
}

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
