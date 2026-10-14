// One bank transfer can reach the app twice: as a slip (right after paying)
// and later as a line in the monthly statement. Their dedupe hashes differ
// (a slip has no statement description), so they are matched here on what
// both sources agree on: date, direction and exact amount, within the same
// bank account.

export type MatchableMovement = {
  occurredAt: string;
  direction: "in" | "out";
  amountSatang: number;
};

const keyOf = (movement: MatchableMovement) =>
  `${movement.occurredAt}|${movement.direction}|${movement.amountSatang}`;

/**
 * Indexes of `rows` already recorded among `existing`. Each existing
 * movement absorbs at most one row, so two identical transfers on the same
 * day still count as two.
 */
export function matchExistingMovements(
  rows: MatchableMovement[],
  existing: MatchableMovement[],
): Set<number> {
  const available = new Map<string, number>();
  for (const movement of existing) {
    available.set(keyOf(movement), (available.get(keyOf(movement)) ?? 0) + 1);
  }

  const matched = new Set<number>();
  rows.forEach((row, index) => {
    const left = available.get(keyOf(row)) ?? 0;
    if (left > 0) {
      matched.add(index);
      available.set(keyOf(row), left - 1);
    }
  });
  return matched;
}
