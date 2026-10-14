import { and, desc, eq, inArray, lt } from "drizzle-orm";

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
import type { ParsedStatement } from "@/lib/parsers/types";

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
    statement: ParsedStatement;
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

    // Previews hold financial data; don't keep abandoned ones around.
    await tx
      .delete(imports)
      .where(
        and(
          eq(imports.userId, userId),
          eq(imports.status, "pending"),
          lt(imports.createdAt, new Date(Date.now() - PENDING_TTL_MS)),
        ),
      );

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
    const rows: NewTransaction[] = parsed.map((row, index) => ({
      userId,
      bankAccountId: pending.bankAccountId,
      importId: pending.id,
      occurredAt: row.occurredAt,
      occurredTime: row.occurredTime,
      description: row.description,
      amount: satangToDecimalString(row.amountSatang),
      direction: row.direction,
      dedupeHash: hashes[index],
    }));

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

    const duplicates = rows.length - inserted;
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

/** Discard a preview the user doesn't want to save. */
export async function cancelImport(userId: string, importId: string): Promise<boolean> {
  const deleted = await db
    .delete(imports)
    .where(
      and(
        eq(imports.userId, userId),
        eq(imports.id, importId),
        eq(imports.status, "pending"),
      ),
    )
    .returning({ id: imports.id });
  return deleted.length > 0;
}
