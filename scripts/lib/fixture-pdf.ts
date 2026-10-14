// Shared helpers for rendering fictional, password-protected bank statement
// PDFs used as parser test fixtures.

import { createWriteStream } from "node:fs";
import { createRequire } from "node:module";

import PDFDocument from "pdfkit";

import { formatBahtNumber } from "../../src/lib/money";

const require = createRequire(import.meta.url);
const fontDir = "@fontsource/noto-sans-thai/files";
const fonts = {
  thai: require.resolve(`${fontDir}/noto-sans-thai-thai-400-normal.woff`),
  latin: require.resolve(`${fontDir}/noto-sans-thai-latin-400-normal.woff`),
  thaiBold: require.resolve(`${fontDir}/noto-sans-thai-thai-700-normal.woff`),
  latinBold: require.resolve(`${fontDir}/noto-sans-thai-latin-700-normal.woff`),
};

// Thai block U+0E00-U+0E7F, built from code points to stay readable.
const THAI_START = String.fromCodePoint(0x0e00);
const THAI_END = String.fromCodePoint(0x0e7f);
const THAI_RUN = new RegExp(`[${THAI_START}-${THAI_END}]+|[^${THAI_START}-${THAI_END}]+`, "g");
const HAS_THAI = new RegExp(`[${THAI_START}-${THAI_END}]`);

/** A4 landscape, in PDF points. */
export const PAGE = { width: 842, height: 595 };

export type FixtureDoc = ReturnType<typeof createFixtureDoc>;

export function createFixtureDoc(output: string, { password, title }: { password: string; title: string }) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    autoFirstPage: false,
    userPassword: password,
    ownerPassword: "fixture-owner-password",
    pdfVersion: "1.7",
    info: { Title: title, Author: "finance-dashboard" },
  });
  doc.pipe(createWriteStream(output));

  /**
   * The font files are split into Thai and Latin subsets, so each run of
   * text is drawn with the subset that has its glyphs.
   */
  function write(text: string, x: number, y: number, bold = false) {
    const runs = text.match(THAI_RUN) ?? [];
    runs.forEach((run, index) => {
      const thai = HAS_THAI.test(run);
      doc.font(thai ? (bold ? fonts.thaiBold : fonts.thai) : bold ? fonts.latinBold : fonts.latin);
      const continued = index < runs.length - 1;
      if (index === 0) doc.text(run, x, y, { continued, lineBreak: false });
      else doc.text(run, { continued, lineBreak: false });
    });
  }

  function writeRight(text: string, x: number, width: number, y: number) {
    doc.font(fonts.latin);
    doc.text(text, x, y, { width, align: "right", lineBreak: false });
  }

  function writeCentered(text: string, x: number, width: number, y: number, bold = false) {
    const thai = HAS_THAI.test(text);
    doc.font(thai ? (bold ? fonts.thaiBold : fonts.thai) : bold ? fonts.latinBold : fonts.latin);
    doc.text(text, x, y, { width, align: "center", lineBreak: false });
  }

  return { doc, write, writeRight, writeCentered };
}

export type FixtureColumn = { x: number; width?: number; label: [thai: string, english: string] };

/** Two header lines (Thai, then English); amount columns are centered. */
export function drawTableHeader(
  { doc, write, writeCentered }: FixtureDoc,
  columns: Record<string, FixtureColumn>,
  top: number,
) {
  doc.fontSize(8);
  for (const [lineIndex, y] of [top - 34, top - 22].entries()) {
    for (const column of Object.values(columns)) {
      const label = column.label[lineIndex];
      if (column.width) writeCentered(label, column.x, column.width, y, true);
      else write(label, column.x, y, true);
    }
  }
  doc.moveTo(30, top - 6).lineTo(PAGE.width - 30, top - 6).stroke();
}

/** "36,712.34" */
export const formatBaht = formatBahtNumber;
