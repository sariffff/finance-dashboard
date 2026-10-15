import { readPdfTextItems, type PdfTextItem } from "@/lib/pdf";

import { parseTableStatement, type TableLayoutConfig } from "./table";
import type { ParsedStatement, StatementParser } from "./types";

// SCB e-Statement (PDF), as downloaded from the SCB EASY app.
//
// Checked against a real statement (savings account, 2026-10): one Thai
// header row per page — วันที่ | เวลา | รายการ | ช่องทาง | รายละเอียด |
// หมายเลขเช็ค | ถอน/โอนออก | ฝาก/โอนเข้า | ยอดคงเหลือ — dates as DD/MM/YYYY
// (CE), times with seconds, signed amounts ("-50.00", "+100.00", balance
// "+48.90"), and a "รวม" row with the page totals. The PDF's font drops some
// Thai tone marks ("ชองทาง", "โอนเขา"), so labels avoid them. The cheque
// number column is unused. See ./table.ts for how columns are found.

export const scbLayout: TableLayoutConfig = {
  bankName: "SCB",
  headerLabels: {
    date: ["date", "วันที่"],
    time: ["time", "เวลา"],
    code: ["code", "รายการ"],
    channel: ["channel", "ช่องทาง", "ชองทาง"],
    // Short stems: "ถอน/โอนออก" may come out of a PDF as one text item or
    // split around the "/" (Thai and Latin glyphs from different fonts).
    withdrawal: ["withdrawal", "ถอน"],
    deposit: ["deposit", "ฝาก"],
    balance: ["balance", "คงเหลือ"],
    description: ["description", "รายละเอียด"],
  },
  requiredColumns: ["date", "withdrawal", "deposit", "balance", "description"],
  broughtForward: /ยกมา|brought forward/i,
  // Page totals ("รวม -2,250.00 +2,790.00"), then the notes and page footer.
  endOfTable: /www\.scb\.co\.th|^total\b|^รวมทั้งสิ้น|^รวม\s+[-+]?[\d,]+\.\d{2}|^หมายเหตุ|^page \d+ of \d+/i,
  describe: (cells) => cells.get("description") ?? "",
};

/** Parse already-extracted PDF text. Exported for unit tests. */
export function parseScbPages(pages: PdfTextItem[][]): ParsedStatement {
  return parseTableStatement(pages, scbLayout);
}

export const scbParser: StatementParser = {
  bankCode: "scb",
  bankName: "ธนาคารไทยพาณิชย์ (SCB)",
  fileType: "pdf",
  async parse({ data, password }) {
    return parseScbPages(await readPdfTextItems(data, password));
  },
};
