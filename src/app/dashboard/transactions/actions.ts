"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { createUserRule, setTransactionCategory } from "@/db/queries/categories";
import { requireUser } from "@/lib/dal";

export type CategoryChangeResult = { ok: true } | { ok: false; error: string };
export type RuleResult = { ok: true; updated: number } | { ok: false; error: string };

const setCategorySchema = z.object({
  transactionId: z.uuid(),
  categoryId: z.uuid(),
});

export async function setCategoryAction(
  transactionId: string,
  categoryId: string,
): Promise<CategoryChangeResult> {
  const user = await requireUser();
  const parsed = setCategorySchema.safeParse({ transactionId, categoryId });
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };

  const updated = await setTransactionCategory(
    user.id,
    parsed.data.transactionId,
    parsed.data.categoryId,
  );
  if (!updated) return { ok: false, error: "เปลี่ยนหมวดไม่สำเร็จ" };

  refresh();
  return { ok: true };
}

const ruleSchema = z.object({
  pattern: z
    .string()
    .trim()
    .min(2, "ข้อความสั้นเกินไป")
    .max(100, "ข้อความยาวเกินไป"),
  categoryId: z.uuid(),
});

export async function createRuleAction(
  pattern: string,
  categoryId: string,
): Promise<RuleResult> {
  const user = await requireUser();
  const parsed = ruleSchema.safeParse({ pattern, categoryId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const updated = await createUserRule(user.id, parsed.data.pattern, parsed.data.categoryId);
  if (updated === undefined) return { ok: false, error: "สร้างกฎไม่สำเร็จ" };

  refresh();
  return { ok: true, updated };
}
