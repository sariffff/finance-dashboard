import { describe, expect, it } from "vitest";
import { z } from "zod";

import { generateJson, type GeminiClient } from "./gemini";
import { fakeGemini } from "./gemini.fake";

const schema = z.object({ answer: z.string().nullable() });

const call = (client: GeminiClient) =>
  generateJson({
    client,
    model: "gemini-3.5-flash",
    system: "system prompt",
    parts: [{ text: "hello" }],
    schema,
    maxOutputTokens: 100,
  });

describe("generateJson", () => {
  it("asks for JSON constrained by the schema and parses the answer", async () => {
    const { client, generateContent } = fakeGemini({ text: '{"answer":"ok"}' });

    expect(await call(client)).toEqual({ answer: "ok" });
    const request = generateContent.mock.calls[0][0];
    expect(request).toMatchObject({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts: [{ text: "hello" }] }],
      config: { systemInstruction: "system prompt", responseMimeType: "application/json", maxOutputTokens: 100 },
    });
    expect(request.config.responseJsonSchema).toMatchObject({
      type: "object",
      properties: { answer: expect.any(Object) },
      required: ["answer"],
    });
  });

  it("returns null when the prompt was blocked, the answer was cut off, or isn't JSON", async () => {
    expect(await call(fakeGemini({ text: '{"answer":"x"}', blockReason: "SAFETY" }).client)).toBeNull();
    expect(await call(fakeGemini({ text: '{"answer":', finishReason: "MAX_TOKENS" }).client)).toBeNull();
    expect(await call(fakeGemini({ text: "not json" }).client)).toBeNull();
    expect(await call(fakeGemini({ text: undefined }).client)).toBeNull();
  });
});
