import { and, count, desc, eq, gte, inArray, isNull, lt, lte, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  bankAccounts,
  imports,
  transactions,
  type Import,
  type NewTransaction,
} from "@/db/schema";
import { computeDedupeHashes } from "@/lib/import/dedupe";
import { satangToDecimalString } from "@/lib/money";
import { matchExistingMovements } from "@/lib/import/cross-source";
import type { ImportPreview } from "@/lib/import/types";
import { parseAmountToSatang } from "@/lib/money";
import type { ParsedTransaction } from "@/lib/parsers/types";

// Every query takes the owner's userId first and filters on it. Callers get
// that id from requireUser() in src/lib/dal.ts, never from client input.

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const INSERT_CHUNK_SIZE = 1000;

export class ImportNotFoundError extends Error {
  override name = "ImportNotFoundError";
}

/** Save a parsed statement for the preview step. */
export async function createPendingImport(
  userId: string,
  input: {
    bankAccountId: string;
    fileName: string;
    fileType: Import["fileType"];
    statement: ImportPreview;
  },
): Promise<Import> {
  return db.transaction(async (tx) => {
    const [account] = await tx
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(
        and(eq(bankAccounts.userId, userId), eq(bankAccounts.id, input.bankAccountId)),
      );
    if (!account) throw new ImportNotFoundError("Bank account not found");

    const [created] = await tx
      .insert(imports)
      .values({
        userId,
        bankAccountId: input.bankAccountId,
        fileName: input.fileName,
        fileType: input.fileType,
        status: "pending",
        preview: input.statement,
        rowCount: input.statement.transactions.length,
      })
      .returning();
    return created;
  });
}

/**
 * Previews hold financial data; don't keep abandoned ones around. Returns
 * the storage keys of their original files so the caller can delete them.
 */
export async function deleteStalePendingImports(userId: string): Promise<string[]> {
  const deleted = await db
    .delete(imports)
    .where(
      and(
        eq(imports.userId, userId),
        eq(imports.status, "pending"),
        lt(imports.createdAt, new Date(Date.now() - PENDING_TTL_MS)),
      ),
    )
    .returning({ storageKey: imports.storageKey });
  return deleted.flatMap((row) => (row.storageKey ? [row.storageKey] : []));
}

/** Record (or clear, with null) where an import's original file is stored. */
export async function setImportStorageKey(
  userId: string,
  importId: string,
  storageKey: string | null,
): Promise<void> {
  await db
    .update(imports)
    .set({ storageKey })
    .where(and(eq(imports.userId, userId), eq(imports.id, importId)));
}

export async function getImport(
  userId: string,
  id: string,
): Promise<Import | undefined> {
  const [found] = await db
    .select()
    .from(imports)
    .where(and(eq(imports.userId, userId), eq(imports.id, id)));
  return found;
}

export function listRecentImports(userId: string, limit = 5) {
  return db
    .select({
      id: imports.id,
      fileName: imports.fileName,
      status: imports.status,
      rowCount: imports.rowCount,
      duplicateCount: imports.duplicateCount,
      createdAt: imports.createdAt,
      bankNickname: bankAccounts.nickname,
    })
    .from(imports)
    .innerJoin(bankAccounts, eq(bankAccounts.id, imports.bankAccountId))
    .where(eq(imports.userId, userId))
    .orderBy(desc(imports.createdAt))
    .limit(limit);
}

/** Which of these hashes the user already has, for marking duplicates. */
export async function findExistingDedupeHashes(
  userId: string,
  hashes: string[],
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  const rows = await db
    .select({ hash: transactions.dedupeHash })
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), inArray(transactions.dedupeHash, hashes)),
    );
  return new Set(rows.map((row) => row.hash));
}

type QueryRunner = Pick<typeof db, "select">;

/**
 * Indexes of `rows` already recorded from the other kind of source in the
 * same account: for a statement, transactions that came from slips; for a
 * slip, transactions that came from statements (see lib/import/cross-source).
 */
export async function findCrossSourceDuplicates(
  runner: QueryRunner,
  userId: string,
  input: { bankAccountId: string; fileType: Import["fileType"]; rows: ParsedTransaction[] },
): Promise<Set<number>> {
  if (input.rows.length === 0) return new Set();
  const dates = input.rows.map((row) => row.occurredAt).sort();

  const existing = await runner
    .select({
      occurredAt: transactions.occurredAt,
      direction: transactions.direction,
      amount: transactions.amount,
    })
    .from(transactions)
    .innerJoin(imports, eq(imports.id, transactions.importId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.bankAccountId, input.bankAccountId),
        gte(transactions.occurredAt, dates[0]),
        lte(transactions.occurredAt, dates.at(-1)!),
        input.fileType === "slip" ? ne(imports.fileType, "slip") : eq(imports.fileType, "slip"),
      ),
    );

  return matchExistingMovements(
    input.rows,
    existing.map((row) => ({ ...row, amountSatang: parseAmountToSatang(row.amount) })),
  );
}

/** Replace a pending import's preview (a slip after the user edits it). */
export async function updatePendingPreview(
  userId: string,
  importId: string,
  preview: ImportPreview,
): Promise<boolean> {
  const updated = await db
    .update(imports)
    .set({ preview, rowCount: preview.transactions.length })
    .where(and(eq(imports.userId, userId), eq(imports.id, importId), eq(imports.status, "pending")))
    .returning({ id: imports.id });
  return updated.length > 0;
}

/**
 * Turn a pending import into transactions. Rows the user already has are
 * skipped by the (userId, dedupeHash) unique constraint and counted as
 * duplicates.
 */
export async function confirmImport(
  userId: string,
  importId: string,
): Promise<{ inserted: number; duplicates: number }> {
  return db.transaction(async (tx) => {
    const [pending] = await tx
      .select()
      .from(imports)
      .where(
        and(
          eq(imports.userId, userId),
          eq(imports.id, importId),
          eq(imports.status, "pending"),
        ),
      )
      .for("update");
    if (!pending?.preview) throw new ImportNotFoundError("Pending import not found");

    const parsed = pending.preview.transactions;
    const hashes = computeDedupeHashes(pending.bankAccountId, parsed);
    const alreadyRecorded = await findCrossSourceDuplicates(tx, userId, {
      bankAccountId: pending.bankAccountId,
      fileType: pending.fileType,
      rows: parsed,
    });
    const rows: NewTransaction[] = [];
    parsed.forEach((row, index) => {
      // Recorded already from the other source (slip vs statement).
      if (alreadyRecorded.has(index)) return;
      rows.push({
        userId,
        bankAccountId: pending.bankAccountId,
        importId: pending.id,
        occurredAt: row.occurredAt,
        occurredTime: row.occurredTime,
        description: row.description,
        amount: satangToDecimalString(row.amountSatang),
        direction: row.direction,
        dedupeHash: hashes[index],
      });
    });

    let inserted = 0;
    for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
      const result = await tx
        .insert(transactions)
        .values(rows.slice(i, i + INSERT_CHUNK_SIZE))
        .onConflictDoNothing({
          target: [transactions.userId, transactions.dedupeHash],
        })
        .returning({ id: transactions.id });
      inserted += result.length;
    }

    const duplicates = parsed.length - inserted;
    await tx
      .update(imports)
      .set({
        status: "completed",
        preview: null,
        rowCount: inserted,
        duplicateCount: duplicates,
      })
      .where(eq(imports.id, pending.id));

    return { inserted, duplicates };
  });
}

/**
 * Discard a preview the user doesn't want to save. Returns the deleted
 * import (so its stored file can be removed too), or undefined.
 */
export async function cancelImport(userId: string, importId: string) {
  const [deleted] = await db
    .delete(imports)
    .where(
      and(
        eq(imports.userId, userId),
        eq(imports.id, importId),
        eq(imports.status, "pending"),
      ),
    )
    .returning({ id: imports.id, storageKey: imports.storageKey });
  return deleted;
}

/** How many of an import's transactions still have no category. */
export async function countUncategorizedInImport(
  userId: string,
  importId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.importId, importId),
        isNull(transactions.categoryId),
      ),
    );
  return row.value;
}
