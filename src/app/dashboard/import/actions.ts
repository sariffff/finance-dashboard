"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createBankAccount, getBankAccount } from "@/db/queries/bank-accounts";
import {
  ImportNotFoundError,
  cancelImport,
  confirmImport,
  createPendingImport,
} from "@/db/queries/imports";
import { categorizeUncategorized, getDefaultCategorizer } from "@/lib/categorize";
import { requireUser } from "@/lib/dal";
import { bankCodes, getParser } from "@/lib/parsers";
import { StatementFormatError } from "@/lib/parsers/types";
import { PdfPasswordError } from "@/lib/pdf";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const bankAccountSchema = z.object({
  bankCode: z.enum(bankCodes, "กรุณาเลือกธนาคาร"),
  nickname: z
    .string()
    .trim()
    .min(1, "กรุณาตั้งชื่อบัญชี")
    .max(50, "ชื่อบัญชียาวเกินไป"),
});

export async function createBankAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = bankAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  await createBankAccount(user.id, parsed.data);
  refresh();
  return {};
}

const uploadSchema = z.object({
  bankAccountId: z.uuid("กรุณาเลือกบัญชี"),
  password: z.string().max(100).optional(),
  file: z
    .instanceof(File, { message: "กรุณาเลือกไฟล์" })
    .refine((file) => file.size > 0, "กรุณาเลือกไฟล์")
    .refine((file) => file.size <= MAX_FILE_BYTES, "ไฟล์ต้องมีขนาดไม่เกิน 5MB"),
});

const PDF_MAGIC = "%PDF-";

export async function uploadStatementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = uploadSchema.safeParse({
    bankAccountId: formData.get("bankAccountId"),
    password: formData.get("password") || undefined,
    file: formData.get("file"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { bankAccountId, password, file } = parsed.data;
  const account = await getBankAccount(user.id, bankAccountId);
  if (!account) return { fieldErrors: { bankAccountId: ["ไม่พบบัญชีนี้"] } };

  const parser = getParser(account.bankCode);
  if (!parser) return { error: "ยังไม่รองรับธนาคารของบัญชีนี้" };

  const data = new Uint8Array(await file.arrayBuffer());
  // Check the file's content, not just its name or the browser's MIME type.
  if (new TextDecoder().decode(data.subarray(0, 5)) !== PDF_MAGIC) {
    return { fieldErrors: { file: ["ไฟล์นี้ไม่ใช่ PDF"] } };
  }

  let importId: string;
  try {
    // The password is used once here to decrypt and then dropped: it is
    // never stored, logged, or sent back to the browser.
    const statement = await parser.parse({ data, password });
    if (statement.transactions.length === 0) {
      return { error: "ไม่พบรายการในไฟล์นี้" };
    }

    const created = await createPendingImport(user.id, {
      bankAccountId: account.id,
      fileName: file.name,
      fileType: parser.fileType,
      statement,
    });
    importId = created.id;
  } catch (error) {
    if (error instanceof PdfPasswordError) {
      return {
        fieldErrors: {
          password: [
            error.reason === "required"
              ? "ไฟล์นี้มีรหัสผ่าน กรุณากรอกรหัส"
              : "รหัสผ่าน PDF ไม่ถูกต้อง",
          ],
        },
      };
    }
    if (error instanceof StatementFormatError) return { error: error.message };
    console.error("Statement import failed", error);
    return { error: "อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่ หรือตรวจสอบว่าเป็น statement ที่ถูกต้อง" };
  }

  redirect(`/dashboard/import/${importId}`);
}

const importIdSchema = z.uuid();

export async function confirmImportAction(importId: string): Promise<FormState> {
  const user = await requireUser();
  const id = importIdSchema.parse(importId);
  try {
    await confirmImport(user.id, id);
  } catch (error) {
    if (error instanceof ImportNotFoundError) {
      return { error: "รายการนำเข้านี้ถูกบันทึกหรือยกเลิกไปแล้ว" };
    }
    throw error;
  }

  // The transactions are saved either way; categorizing is best effort and
  // can be retried from the import page.
  try {
    await categorizeUncategorized(user.id, { importId: id, categorizer: getDefaultCategorizer() });
  } catch (error) {
    console.error("Categorization after import failed", error);
  }
  redirect(`/dashboard/import/${id}`);
}

export async function recategorizeImportAction(importId: string): Promise<void> {
  const user = await requireUser();
  await categorizeUncategorized(user.id, {
    importId: importIdSchema.parse(importId),
    categorizer: getDefaultCategorizer(),
  });
  refresh();
}

export async function cancelImportAction(importId: string): Promise<void> {
  const user = await requireUser();
  await cancelImport(user.id, importIdSchema.parse(importId));
  redirect("/dashboard/import");
}
