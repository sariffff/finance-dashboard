import { eq } from "drizzle-orm";

import { db } from "@/db";
import { categorizeUncategorized } from "@/lib/categorize";
import type { AiCategorizer } from "@/lib/categorize/ai";
import { computeDedupeHashes } from "@/lib/import/dedupe";
import { satangToDecimalString } from "@/lib/money";
import { addMonths, currentDate } from "@/lib/month";
import { deleteFile, isStorageConfigured } from "@/lib/storage";

import { generateDemoTransactions, type DemoAccount, type DemoTransaction } from "./demo-data";
import { createBankAccount } from "./queries/bank-accounts";
import { bankAccounts, categories, categoryRules, imports, monthlyInsights, transactions } from "./schema";

const DEMO_MONTHS = 12;

const ACCOUNTS: Record<DemoAccount, { bankCode: string; nickname: string; filePrefix: string }> = {
  scb: { bankCode: "scb", nickname: "บัญชีออมทรัพย์ SCB", filePrefix: "SCB_eStatement" },
  kbank: { bankCode: "kbank", nickname: "บัญชี KBANK (ใช้จ่ายประจำวัน)", filePrefix: "KBANK_Statement" },
};

/**
 * Throw away everything in the demo account and rebuild 12 months of
 * fictional history ending today. The account is shared and its password is
 * public, so a fresh, known state on every seed is a feature.
 *
 * Rows go through the real pipeline — one completed import per account and
 * month, then rules → "AI" → ai_cache — with a replay categorizer that
 * answers from the generator's known answers instead of calling Claude.
 */
export async function resetDemoData(userId: string, now = new Date()) {
  await clearDemoData(userId);

  const today = currentDate(now);
  const rows = generateDemoTransactions({ endMonth: today.slice(0, 7), months: DEMO_MONTHS, today });

  for (const [account, config] of Object.entries(ACCOUNTS) as [DemoAccount, (typeof ACCOUNTS)[DemoAccount]][]) {
    const { id: bankAccountId } = await createBankAccount(userId, {
      bankCode: config.bankCode,
      nickname: config.nickname,
    });

    const byMonth = Map.groupBy(
      rows.filter((row) => row.account === account),
      (row) => row.occurredAt.slice(0, 7),
    );
    for (const [month, monthRows] of byMonth) {
      await insertMonthlyImport(userId, bankAccountId, `${config.filePrefix}_${month}.pdf`, month, monthRows);
    }
  }

  const stats = await categorizeUncategorized(userId, { categorizer: replayCategorizer(rows) });
  return { transactions: rows.length, months: DEMO_MONTHS, ...stats };
}

async function clearDemoData(userId: string) {
  // Visitors may have uploaded statements or slips to the demo account.
  const stored = await db
    .select({ key: imports.storageKey })
    .from(imports)
    .where(eq(imports.userId, userId));
  if (isStorageConfigured()) {
    for (const { key } of stored) if (key) await deleteFile(key);
  }

  // Deleting the bank accounts cascades to their imports and transactions.
  await db.delete(bankAccounts).where(eq(bankAccounts.userId, userId));
  await db.delete(categoryRules).where(eq(categoryRules.userId, userId));
  await db.delete(categories).where(eq(categories.userId, userId));
  await db.delete(monthlyInsights).where(eq(monthlyInsights.userId, userId));
}

async function insertMonthlyImport(
  userId: string,
  bankAccountId: string,
  fileName: string,
  month: string,
  rows: DemoTransaction[],
) {
  // Look like it was uploaded a few days after the statement period ended.
  const uploadedAt = new Date(`${addMonths(month, 1)}-03T10:00:00+07:00`);
  const createdAt = uploadedAt > new Date() ? new Date() : uploadedAt;

  const [created] = await db
    .insert(imports)
    .values({ userId, bankAccountId, fileName, fileType: "pdf", status: "completed", rowCount: rows.length, createdAt })
    .returning({ id: imports.id });

  const hashes = computeDedupeHashes(
    bankAccountId,
    rows.map((row) => ({ ...row, balanceSatang: null, code: null, channel: null })),
  );
  await db.insert(transactions).values(
    rows.map((row, index) => ({
      userId,
      bankAccountId,
      importId: created.id,
      occurredAt: row.occurredAt,
      occurredTime: row.occurredTime,
      description: row.description,
      amount: satangToDecimalString(row.amountSatang),
      direction: row.direction,
      dedupeHash: hashes[index],
    })),
  );
}

/** Answers like the AI would, from the generator's known answers. */
function replayCategorizer(rows: DemoTransaction[]): AiCategorizer {
  const answers = new Map(rows.filter((row) => row.ai).map((row) => [row.description, row.ai!]));
  return async (items) =>
    items.flatMap((item) => {
      const answer = answers.get(item.description);
      return answer ? [{ id: item.id, ...answer }] : [];
    });
}
