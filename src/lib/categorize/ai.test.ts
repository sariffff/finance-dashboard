import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import {
  createClaudeCategorizer,
  validateAiResults,
  type AiCategoryRequest,
  type CategoryOption,
} from "./ai";

const categories: CategoryOption[] = [
  { name: "อาหารและเครื่องดื่ม", kind: "expense" },
  { name: "เดินทาง", kind: "expense" },
  { name: "รายได้อื่น", kind: "income" },
];

const items: AiCategoryRequest[] = [
  { id: 0, description: "ร้านอาหารส้มตำนัว", direction: "out" },
  { id: 1, description: "รับโอนจาก PromptPay นาย สมชาย ใจดี", direction: "in" },
];

describe("validateAiResults", () => {
  it("keeps valid answers", () => {
    expect(
      validateAiResults(
        {
          results: [
            { id: 0, categoryName: "อาหารและเครื่องดื่ม", merchant: "ส้มตำนัว" },
            { id: 1, categoryName: "รายได้อื่น", merchant: null },
          ],
        },
        items,
        categories,
      ),
    ).toEqual([
      { id: 0, categoryName: "อาหารและเครื่องดื่ม", merchant: "ส้มตำนัว" },
      { id: 1, categoryName: "รายได้อื่น", merchant: null },
    ]);
  });

  it("drops invented categories, wrong-direction categories and unknown ids", () => {
    expect(
      validateAiResults(
        {
          results: [
            { id: 0, categoryName: "ค่ากาแฟ", merchant: null }, // not in the list
            { id: 1, categoryName: "เดินทาง", merchant: null }, // expense for incoming money
            { id: 9, categoryName: "เดินทาง", merchant: null }, // no such item
          ],
        },
        items,
        categories,
      ),
    ).toEqual([]);
  });

  it("drops merchants that don't appear in the description", () => {
    const [result] = validateAiResults(
      { results: [{ id: 0, categoryName: "อาหารและเครื่องดื่ม", merchant: "KFC" }] },
      items,
      categories,
    );
    expect(result.merchant).toBeNull();
  });

  it("returns nothing for output that doesn't match the schema", () => {
    expect(validateAiResults({ answer: "food" }, items, categories)).toEqual([]);
    expect(validateAiResults("not json", items, categories)).toEqual([]);
  });
});

describe("createClaudeCategorizer", () => {
  function fakeClient(response: object) {
    const parse = vi.fn().mockResolvedValue(response);
    return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
  }

  it("sends the model, fallbacks and categories, and validates the answer", async () => {
    const { client, parse } = fakeClient({
      stop_reason: "end_turn",
      parsed_output: { results: [{ id: 0, categoryName: "อาหารและเครื่องดื่ม", merchant: null }] },
    });

    const results = await createClaudeCategorizer({ client })(items, categories);

    expect(results).toEqual([{ id: 0, categoryName: "อาหารและเครื่องดื่ม", merchant: null }]);
    const request = parse.mock.calls[0][0];
    expect(request).toMatchObject({
      model: "claude-opus-5-5",
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01"],
      output_config: { effort: "low" },
    });
    expect(JSON.parse(request.messages[0].content)).toEqual({
      categories: { in: ["รายได้อื่น"], out: ["อาหารและเครื่องดื่ม", "เดินทาง"] },
      transactions: items,
    });
  });

  it("uses the configured model, and skips fallbacks where the model has none", async () => {
    const { client, parse } = fakeClient({ stop_reason: "end_turn", parsed_output: { results: [] } });
    await createClaudeCategorizer({ client, model: "claude-haiku-5-5" })(items, categories);

    const request = parse.mock.calls[0][0];
    expect(request.model).toBe("claude-haiku-5-5");
    expect(request).not.toHaveProperty("fallbacks");
    expect(request).not.toHaveProperty("betas");
  });

  it("treats a refusal as no answer", async () => {
    const { client } = fakeClient({ stop_reason: "refusal", parsed_output: null });
    expect(await createClaudeCategorizer({ client })(items, categories)).toEqual([]);
  });

  it("splits large inputs into batches", async () => {
    const { client, parse } = fakeClient({ stop_reason: "end_turn", parsed_output: { results: [] } });
    const many = Array.from({ length: 120 }, (_, id) => ({ id, description: `ร้าน ${id}`, direction: "out" as const }));
    await createClaudeCategorizer({ client })(many, categories);
    expect(parse).toHaveBeenCalledTimes(3);
  });
});
