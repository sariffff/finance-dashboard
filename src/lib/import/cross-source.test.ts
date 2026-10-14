import { describe, expect, it } from "vitest";

import { matchExistingMovements, type MatchableMovement } from "./cross-source";

const transfer = (occurredAt: string, amountSatang: number, direction: "in" | "out" = "out"): MatchableMovement => ({
  occurredAt,
  amountSatang,
  direction,
});

describe("matchExistingMovements", () => {
  it("matches on date, direction and exact amount", () => {
    expect(
      matchExistingMovements(
        [transfer("2026-10-01", 8500), transfer("2026-10-01", 8501), transfer("2026-10-02", 8500), transfer("2026-10-01", 8500, "in")],
        [transfer("2026-10-01", 8500)],
      ),
    ).toEqual(new Set([0]));
  });

  it("lets each existing movement absorb only one row", () => {
    // Two identical coffees on one day, but only one slip was uploaded.
    expect(
      matchExistingMovements(
        [transfer("2026-10-01", 6500), transfer("2026-10-01", 6500)],
        [transfer("2026-10-01", 6500)],
      ),
    ).toEqual(new Set([0]));
  });

  it("matches nothing when there is nothing recorded", () => {
    expect(matchExistingMovements([transfer("2026-10-01", 100)], [])).toEqual(new Set());
  });
});
