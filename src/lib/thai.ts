// Thai characters are built from code points so the regexes stay readable
// (combining vowels and tone marks are invisible on their own).
const SARA_AA = String.fromCodePoint(0x0e32); // า
const SARA_AM = String.fromCodePoint(0x0e33); // ำ
const NIKHAHIT = String.fromCodePoint(0x0e4d); // ํ
const TONE_MARKS = `${String.fromCodePoint(0x0e48)}-${String.fromCodePoint(0x0e4b)}`; // ่ to ๋

const SPLIT_SARA_AM = new RegExp(`${NIKHAHIT}([${TONE_MARKS}]?)${SARA_AA}`, "g");
const SARA_AM_WITH_STRAY_AA = new RegExp(`${SARA_AM}${SARA_AA}`, "g");

/**
 * Text pulled out of PDFs often mangles SARA AM: split into NIKHAHIT +
 * SARA AA (sometimes with a tone mark in between), or followed by a stray
 * SARA AA when the font draws it as two glyphs. Put it back so descriptions
 * match what users type and what category rules look for.
 */
export function normalizeThai(text: string): string {
  return text
    .normalize("NFC")
    .replace(SPLIT_SARA_AM, `$1${SARA_AM}`)
    .replace(SARA_AM_WITH_STRAY_AA, SARA_AM)
    .replace(/\s+/g, " ")
    .trim();
}
