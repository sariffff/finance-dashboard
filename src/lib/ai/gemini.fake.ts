import { vi } from "vitest";

import type { GeminiClient } from "./gemini";

/** A stub Gemini client for tests — tests never call the real API. */
export function fakeGemini(response: { text?: string; finishReason?: string; blockReason?: string }) {
  const generateContent = vi.fn().mockResolvedValue({
    text: response.text,
    candidates: [{ finishReason: response.finishReason ?? "STOP" }],
    promptFeedback: response.blockReason ? { blockReason: response.blockReason } : undefined,
  });
  return { client: { models: { generateContent } } as unknown as GeminiClient, generateContent };
}
