"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getBankAccount } from "@/db/queries/bank-accounts";
import {
  ImportNotFoundError,
  confirmImport,
  createPendingImport,
  findCrossSourceDuplicates,
  getImport,
  setImportStorageKey,
  updatePendingPreview,
} from "@/db/queries/imports";
import { db } from "@/db";
import { isAiConfigured, modelFor } from "@/lib/ai/config";
import { categorizeUncategorized, getDefaultCategorizer } from "@/lib/categorize";
import { requireUser } from "@/lib/dal";
import type { SlipDraft } from "@/lib/import/types";
import { parseAmountToSatang } from "@/lib/money";
import type { ParsedTransaction } from "@/lib/parsers/types";
import { createClaudeSlipReader, emptySlipDraft, type SlipImage } from "@/lib/slips/reader";
import { importFileKey, isStorageConfigured, putFile } from "@/lib/storage";

import type { FormState } from "./actions";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const uploadSchema = z.object({
  bankAccountId: z.uuid("กรุณาเลือกบัญชี"),
  file: z
    .instanceof(File, { message: "กรุณาเลือกรูปสลิป" })
    .refine((file) => file.size > 0, "กรุณาเลือกรูปสลิป")
    .refine((file) => file.size <= MAX_FILE_BYTES, "รูปต้องมีขนาดไม่เกิน 5MB"),
});

/** Image type from the file's first bytes, not its name or claimed MIME type. */
function detectImage(data: Uint8Array): { mediaType: SlipImage["mediaType"]; extension: string } | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...data.subarray(from, to));
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { mediaType: "image/jpeg", extension: "jpg" };
  if (data[0] === 0x89 && ascii(1, 4) === "PNG") return { mediaType: "image/png", extension: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mediaType: "image/webp", extension: "webp" };
  return null;
}

async function readSlip(image: SlipImage): Promise<SlipDraft> {
  if (!isAiConfigured()) return emptySlipDraft();
  try {
    return await createClaudeSlipReader({ model: modelFor("slip") }).read(image);
  } catch (error) {
    // Reading is a convenience: on failure the user fills the form in.
    console.error("Reading slip failed", error);
    return emptySlipDraft();
  }
}

export async function uploadSlipAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = uploadSchema.safeParse({
    bankAccountId: formData.get("bankAccountId"),
    file: formData.get("file"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const { bankAccountId, file } = parsed.data;
  const account = await getBankAccount(user.id, bankAccountId);
  if (!account) return { fieldErrors: { bankAccountId: ["ไม่พบบัญชีนี้"] } };

  const data = new Uint8Array(await file.arrayBuffer());
  const type = detectImage(data);
  if (!type) return { fieldErrors: { file: ["รองรับเฉพาะรูป JPG, PNG หรือ WEBP"] } };

  const slip = await readSlip({ data, mediaType: type.mediaType });
  const created = await createPendingImport(user.id, {
    bankAccountId: account.id,
    fileName: file.name,
    fileType: "slip",
    statement: { transactions: [], warnings: [], slip },
  });

  if (isStorageConfigured()) {
    try {
      const key = importFileKey(user.id, created.id, type.extension);
      await putFile(key, data, type.mediaType);
      await setImportStorageKey(user.id, created.id, key);
    } catch (error) {
      console.error("Storing the slip image failed", error);
    }
  }

  redirect(`/dashboard/import/${created.id}`);
}

const confirmSchema = z.object({
  date: z.iso.date("กรุณาระบุวันที่"),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "เวลาไม่ถูกต้อง")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  amount: z.string().refine((value) => {
    try {
      return parseAmountToSatang(value) > 0;
    } catch {
      return false;
    }
  }, "จำนวนเงินไม่ถูกต้อง"),
  direction: z.enum(["in", "out"]),
  description: z.string().trim().min(1, "กรุณาใส่รายละเอียด").max(200, "รายละเอียดยาวเกินไป"),
});

export async function confirmSlipAction(
  importId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const id = z.uuid().parse(importId);
  const found = await getImport(user.id, id);
  if (!found || found.status !== "pending" || found.fileType !== "slip") {
    return { error: "สลิปนี้ถูกบันทึกหรือยกเลิกไปแล้ว" };
  }

  const parsed = confirmSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const transaction: ParsedTransaction = {
    occurredAt: parsed.data.date,
    occurredTime: parsed.data.time ?? null,
    description: parsed.data.description,
    amountSatang: parseAmountToSatang(parsed.data.amount),
    direction: parsed.data.direction,
    balanceSatang: null,
    code: null,
    channel: "slip",
  };

  // The same transfer may already be in an imported statement.
  const duplicates = await findCrossSourceDuplicates(db, user.id, {
    bankAccountId: found.bankAccountId,
    fileType: "slip",
    rows: [transaction],
  });
  if (duplicates.size > 0) {
    return { error: "มีรายการวันที่และจำนวนเงินเดียวกันจาก statement ของบัญชีนี้อยู่แล้ว จึงไม่บันทึกซ้ำ" };
  }

  await updatePendingPreview(user.id, id, { ...found.preview!, transactions: [transaction] });
  try {
    await confirmImport(user.id, id);
  } catch (error) {
    if (error instanceof ImportNotFoundError) return { error: "สลิปนี้ถูกบันทึกหรือยกเลิกไปแล้ว" };
    throw error;
  }

  try {
    await categorizeUncategorized(user.id, { importId: id, categorizer: getDefaultCategorizer() });
  } catch (error) {
    console.error("Categorization after slip import failed", error);
  }
  redirect(`/dashboard/import/${id}`);
}
