import { describe, expect, it } from "vitest";

import type { ParsedTransaction } from "@/lib/parsers/types";

import { computeDedupeHashes } from "./dedupe";

const coffee: ParsedTransaction = {
  occurredAt: "2026-09-02",
  occurredTime: "15:20",
  description: "ร้านน้ำปั่นหน้าออฟฟิศ",
  amountSatang: 4500,
  direction: "out",
  balanceSatang: null,
  code: "X2",
  channel: "ENET",
};
const salary: ParsedTransaction = {
  ...coffee,
  description: "เงินเดือน",
  amountSatang: 3_500_000,
  direction: "in",
};

describe("computeDedupeHashes", () => {
  it("is stable across imports of the same statement", () => {
    expect(computeDedupeHashes("acc-1", [coffee, salary])).toEqual(
      computeDedupeHashes("acc-1", [coffee, salary]),
    );
  });

  it("keeps two identical rows in one statement apart", () => {
    const [first, second] = computeDedupeHashes("acc-1", [coffee, coffee]);
    expect(first).not.toBe(second);
  });

  it("matches rows shared by overlapping statements", () => {
    // Statement B starts with the same two coffees that ended statement A.
    const a = computeDedupeHashes("acc-1", [salary, coffee, coffee]);
    const b = computeDedupeHashes("acc-1", [coffee, coffee, salary]);
    expect(b.slice(0, 2)).toEqual(a.slice(1, 3));
  });

  it("ignores balance, code and channel but not account or direction", () => {
    const [base] = computeDedupeHashes("acc-1", [coffee]);
    expect(
      computeDedupeHashes("acc-1", [{ ...coffee, balanceSatang: 1, code: null, channel: "ATM" }])[0],
    ).toBe(base);
    expect(computeDedupeHashes("acc-2", [coffee])[0]).not.toBe(base);
    expect(computeDedupeHashes("acc-1", [{ ...coffee, direction: "in" }])[0]).not.toBe(base);
  });
});
