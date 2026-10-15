import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({}) as Record<string, string | undefined>);
vi.mock("@/env", () => ({ env }));

import { isAiConfigured, modelFor } from "./config";

beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
});

describe("modelFor", () => {
  it("prefers the per-task model, then AI_MODEL", () => {
    env.AI_MODEL = "claude-haiku-5-5";
    env.AI_MODEL_SLIP = "gemini-3.5-flash";
    expect(modelFor("slip")).toBe("gemini-3.5-flash");
    expect(modelFor("categorize")).toBe("claude-haiku-5-5");
  });

  it("defaults to the provider that has a key, Claude when both do", () => {
    expect(modelFor("insights")).toBe("claude-opus-5-5");
    env.GEMINI_API_KEY = "g";
    expect(modelFor("insights")).toBe("gemini-3.5-flash");
    env.ANTHROPIC_API_KEY = "a";
    expect(modelFor("insights")).toBe("claude-opus-5-5");
  });
});

describe("isAiConfigured", () => {
  it("needs the key of the chosen model's provider", () => {
    expect(isAiConfigured("categorize")).toBe(false);

    env.GEMINI_API_KEY = "g";
    expect(isAiConfigured("categorize")).toBe(true);

    // A Claude model without an Anthropic key stays off, even with a Gemini key.
    env.AI_MODEL_CATEGORIZE = "claude-sonnet-5-5";
    expect(isAiConfigured("categorize")).toBe(false);
    expect(isAiConfigured("slip")).toBe(true);
  });
});
