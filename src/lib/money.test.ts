import { describe, expect, it } from "vitest";

import {
  formatSatang,
  parseAmountToSatang,
  satangToDecimalString,
} from "@/lib/money";

describe("parseAmountToSatang", () => {
  it.each([
    ["0", 0],
    ["99", 9900],
    ["1,234.50", 123450],
    ["1,234.5", 123450],
    ["฿ 1,000,000.01", 100000001],
    ["-20.75", -2075],
    ["-0.00", 0],
    ["  42.10 ", 4210],
  ])("parses %j as %d satang", (input, expected) => {
    expect(parseAmountToSatang(input)).toBe(expected);
  });

  it("avoids float rounding errors", () => {
    // 0.1 + 0.2 !== 0.3 in floats; satang math must be exact
    expect(parseAmountToSatang("0.10") + parseAmountToSatang("0.20")).toBe(
      parseAmountToSatang("0.30"),
    );
  });

  it.each(["", "abc", "1.234", "1.2.3", "--5", "12a"])(
    "rejects %j",
    (input) => {
      expect(() => parseAmountToSatang(input)).toThrow(/Invalid amount/);
    },
  );
});

describe("satangToDecimalString", () => {
  it.each([
    [0, "0.00"],
    [5, "0.05"],
    [123450, "1234.50"],
    [-2075, "-20.75"],
  ])("converts %d to %j", (satang, expected) => {
    expect(satangToDecimalString(satang)).toBe(expected);
  });

  it("round-trips with parseAmountToSatang", () => {
    for (const satang of [0, 1, 99, 100, 123456789, -42]) {
      expect(parseAmountToSatang(satangToDecimalString(satang))).toBe(satang);
    }
  });

  it("rejects non-integers", () => {
    expect(() => satangToDecimalString(1.5)).toThrow();
  });
});

describe("formatSatang", () => {
  it("formats as Thai baht", () => {
    expect(formatSatang(123450)).toBe("฿1,234.50");
  });
});
