import { createHash } from "node:crypto";

import type { ParsedTransaction } from "@/lib/parsers/types";

/**
 * Stable fingerprint per transaction, used with the unique
 * (userId, dedupeHash) constraint so re-importing a statement — or one whose
 * period overlaps an earlier one — never creates duplicates.
 *
 * Two genuinely identical rows (same time, amount and description, e.g. two
 * drinks paid separately) are told apart by their occurrence number, which
 * is the same in every statement that contains them because statements keep
 * their row order.
 */
export function computeDedupeHashes(
  bankAccountId: string,
  transactions: ParsedTransaction[],
): string[] {
  const occurrences = new Map<string, number>();

  return transactions.map((tx) => {
    const key = [
      bankAccountId,
      tx.occurredAt,
      tx.occurredTime ?? "",
      tx.direction,
      tx.amountSatang,
      tx.description.toLowerCase(),
    ].join("|");
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);

    return createHash("sha256").update(`${key}|${occurrence}`).digest("hex");
  });
}
