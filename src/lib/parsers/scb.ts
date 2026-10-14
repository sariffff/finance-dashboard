import { readPdfTextItems, type PdfTextItem } from "@/lib/pdf";

import { parseTableStatement, type TableLayoutConfig } from "./table";
import type { ParsedStatement, StatementParser } from "./types";

// SCB e-Statement (PDF), as sent by the SCB EASY app.
//
// The layout is based on public information about SCB statements (column
// headers วันที่ / เวลา / รายการ / ช่องทาง / ถอนเงิน / ฝากเงิน / ยอดเงินคงเหลือ
// / รายละเอียด, with English equivalents) — not yet checked against a real
// statement. See ./table.ts for how columns are found.

export const scbLayout: TableLayoutConfig = {
  bankName: "SCB",
  headerLabels: {
    date: ["date", "วันที่"],
    time: ["time", "เวลา"],
    code: ["code", "รายการ"],
    channel: ["channel", "ช่องทาง"],
    withdrawal: ["withdrawal", "ถอนเงิน"],
    deposit: ["deposit", "ฝากเงิน"],
    balance: ["balance", "ยอดเงินคงเหลือ"],
    description: ["description", "รายละเอียด"],
  },
  requiredColumns: ["date", "withdrawal", "deposit", "balance", "description"],
  broughtForward: /ยกมา|brought forward/i,
  endOfTable: /www\.scb\.co\.th|^total\b|^รวมทั้งสิ้น/i,
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
