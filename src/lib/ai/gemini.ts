import { FinishReason, GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";

import { env } from "@/env";

import type { GeminiModel } from "./models";

/** The part of the SDK client we use — lets tests pass a stub. */
export type GeminiClient = { models: Pick<GoogleGenAI["models"], "generateContent"> };

export function createGeminiClient(): GeminiClient {
  return new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
    httpOptions: { timeout: 60_000, retryOptions: { attempts: 2 } },
  });
}

/**
 * Ask Gemini for JSON shaped by a Zod schema. The schema is sent as JSON
 * Schema so the model is constrained to it, but the result is still
 * untrusted: callers validate it with the same schema (and their own
 * checks) before using anything. Returns null when the model declined or
 * produced nothing parseable.
 */
export async function generateJson({
  client,
  model,
  system,
  parts,
  schema,
  maxOutputTokens,
}: {
  client: GeminiClient;
  model: GeminiModel;
  system: string;
  parts: Part[];
  schema: z.ZodType;
  maxOutputTokens: number;
}): Promise<unknown> {
  const response = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(schema, { io: "input" }),
      maxOutputTokens,
    },
  });

  const candidate = response.candidates?.[0];
  if (response.promptFeedback?.blockReason || candidate?.finishReason !== FinishReason.STOP) return null;
  const text = response.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
