import { describe, expect, it } from "vitest";

import { normalizeThai } from "./thai";

const cp = (...points: number[]) => String.fromCodePoint(...points);

describe("normalizeThai", () => {
  it("maps font Private Use Area tone marks back to Thai", () => {
    // As extracted from a real SCB statement header: ช + U+F70A + องทาง
    const extracted = `${cp(0x0e0a, 0xf70a)}องทาง`;
    expect(normalizeThai(extracted)).toBe(`${cp(0x0e0a, 0x0e48)}องทาง`); // ช่องทาง
    // เข + U+F70B + า → เข้า
    expect(normalizeThai(`เข${cp(0xf70b)}า`)).toBe(`เข${cp(0x0e49)}า`);
    // Shifted-left variants and lowered vowels too.
    expect(normalizeThai(`ป${cp(0xf713)}า`)).toBe(`ป${cp(0x0e48)}า`);
    expect(normalizeThai(`ฎ${cp(0xf718)}`)).toBe(`ฎ${cp(0x0e38)}`);
  });

  it("joins a split SARA AM, also when its tone mark came out as a PUA glyph", () => {
    // น + NIKHAHIT + (PUA mai tho) + SARA AA → น้ำ
    expect(normalizeThai(`น${cp(0x0e4d, 0xf70b, 0x0e32)}`)).toBe(`น${cp(0x0e49, 0x0e33)}`);
  });

  it("collapses whitespace and leaves ordinary text alone", () => {
    expect(normalizeThai("  รับโอนจาก   KTB x1234 ")).toBe("รับโอนจาก KTB x1234");
  });
});
