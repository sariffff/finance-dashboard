// Thai characters are built from code points so the regexes stay readable
// (combining vowels and tone marks are invisible on their own).
const SARA_AA = String.fromCodePoint(0x0e32); // า
const SARA_AM = String.fromCodePoint(0x0e33); // ำ
const NIKHAHIT = String.fromCodePoint(0x0e4d); // ํ
const TONE_MARKS = `${String.fromCodePoint(0x0e48)}-${String.fromCodePoint(0x0e4b)}`; // ่ to ๋

const SPLIT_SARA_AM = new RegExp(`${NIKHAHIT}([${TONE_MARKS}]?)${SARA_AA}`, "g");
const SARA_AM_WITH_STRAY_AA = new RegExp(`${SARA_AM}${SARA_AA}`, "g");

// Thai fonts draw tone marks and upper/lower vowels at shifted positions
// (e.g. lower when there is no vowel above) using Private Use Area glyphs
// U+F700–U+F71A. PDFs made with such fonts — the real SCB e-Statement among
// them — put those code points in the text, so "ช่อง" comes out as
// "ช" + U+F70A + "อง". Map each back to the standard Thai character.
const THAI_PUA_TARGETS = [
  0x0e10, 0x0e34, 0x0e35, 0x0e36, 0x0e37, 0x0e48, 0x0e49, 0x0e4a, 0x0e4b, 0x0e4c, // F700–F709
  0x0e48, 0x0e49, 0x0e4a, 0x0e4b, 0x0e4c, 0x0e0d, 0x0e31, 0x0e4d, 0x0e47, 0x0e48, // F70A–F713
  0x0e49, 0x0e4a, 0x0e4b, 0x0e4c, 0x0e38, 0x0e39, 0x0e3a, // F714–F71A
];
const THAI_PUA = new RegExp(
  `[${String.fromCodePoint(0xf700)}-${String.fromCodePoint(0xf700 + THAI_PUA_TARGETS.length - 1)}]`,
  "g",
);
const fromThaiPua = (char: string) =>
  String.fromCodePoint(THAI_PUA_TARGETS[char.codePointAt(0)! - 0xf700]);

/**
 * Text pulled out of PDFs often mangles Thai: tone marks and vowels as font
 * Private Use Area glyphs, and SARA AM split into NIKHAHIT + SARA AA
 * (sometimes with a tone mark in between) or followed by a stray SARA AA
 * when the font draws it as two glyphs. Put it back so descriptions match
 * what users type and what category rules look for.
 */
export function normalizeThai(text: string): string {
  return text
    .replace(THAI_PUA, fromThaiPua)
    .normalize("NFC")
    .replace(SPLIT_SARA_AM, `$1${SARA_AM}`)
    .replace(SARA_AM_WITH_STRAY_AA, SARA_AM)
    .replace(/\s+/g, " ")
    .trim();
}
