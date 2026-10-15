import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { fakeGemini } from "@/lib/ai/gemini.fake";

import { createClaudeSlipReader, createGeminiSlipReader, emptySlipDraft, validateSlipFields } from "./reader";

const slip = {
  isSlip: true,
  date: "2026-10-14",
  time: "9:05",
  amount: "1,250.75",
  fromName: "นาย ตัวอย่าง ทดสอบ",
  toName: "ร้านกาแฟดีดี",
  bank: "SCB",
  reference: "2026101409051234",
  memo: null,
};

describe("validateSlipFields", () => {
  it("normalizes what the AI read", () => {
    expect(validateSlipFields(slip)).toEqual({
      readByAi: true,
      date: "2026-10-14",
      time: "09:05",
      amount: "1250.75",
      fromName: "นาย ตัวอย่าง ทดสอบ",
      toName: "ร้านกาแฟดีดี",
      bank: "SCB",
      reference: "2026101409051234",
      memo: null,
    });
  });

  it("converts a Buddhist-era year that slipped through", () => {
    expect(validateSlipFields({ ...slip, date: "2569-10-14" }).date).toBe("2026-10-14");
  });

  it("blanks out fields that don't parse instead of guessing", () => {
    const result = validateSlipFields({ ...slip, date: "14/10/69", time: "late", amount: "-50" });
    expect(result).toMatchObject({ readByAi: true, date: null, time: null, amount: null });
  });

  it("returns an empty draft for non-slips and malformed output", () => {
    expect(validateSlipFields({ ...slip, isSlip: false })).toEqual(emptySlipDraft());
    expect(validateSlipFields({ amount: 5 })).toEqual(emptySlipDraft());
  });
});

describe("createClaudeSlipReader", () => {
  it("sends the image to the configured model and validates the answer", async () => {
    const parse = vi.fn().mockResolvedValue({ stop_reason: "end_turn", parsed_output: slip });
    const client = { beta: { messages: { parse } } } as unknown as Anthropic;

    const draft = await createClaudeSlipReader({ client, model: "claude-haiku-5-5" }).read({
      data: new Uint8Array([0xff, 0xd8, 0xff]),
      mediaType: "image/jpeg",
    });

    expect(draft.amount).toBe("1250.75");
    const request = parse.mock.calls[0][0];
    expect(request.model).toBe("claude-haiku-5-5");
    expect(request.messages[0].content[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "/9j/" },
    });
  });
});

describe("createGeminiSlipReader", () => {
  it("sends the image inline and validates the answer", async () => {
    const { client, generateContent } = fakeGemini({ text: JSON.stringify(slip) });

    const draft = await createGeminiSlipReader({ client, model: "gemini-3.5-flash" }).read({
      data: new Uint8Array([0xff, 0xd8, 0xff]),
      mediaType: "image/jpeg",
    });

    expect(draft.amount).toBe("1250.75");
    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe("gemini-3.5-flash");
    expect(request.contents[0].parts[0]).toEqual({ inlineData: { mimeType: "image/jpeg", data: "/9j/" } });
  });

  it("returns an empty draft when the model gives no usable answer", async () => {
    const { client } = fakeGemini({ text: "{}", blockReason: "SAFETY" });
    const draft = await createGeminiSlipReader({ client }).read({ data: new Uint8Array([1]), mediaType: "image/png" });
    expect(draft).toEqual(emptySlipDraft());
  });
});
