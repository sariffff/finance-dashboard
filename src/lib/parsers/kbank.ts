import { readPdfTextItems, type PdfTextItem } from "@/lib/pdf";

import { parseTableStatement, type TableLayoutConfig } from "./table";
import type { ParsedStatement, StatementParser } from "./types";

// KBank (Kasikornbank) statement PDF, as sent by the K PLUS app.
//
// Based on public information (open-source K PLUS statement parsers): DD-MM-YY
// dates, a transaction type ("Transfer Withdrawal", "Payment", ...), one
// amount column for both directions, the running balance, the channel and a
// details column ("To X1234 ...", "Paid for Ref ...", "Ref Code EDC..."). Not
// yet checked against a real statement. See ./table.ts for how columns are
// found.

// With a single amount column, the running balance decides the direction;
// these words are only the fallback when no balance is printed.
const INCOMING = /deposit|payroll|interest|refund|รับ|ฝาก|ดอกเบี้ย|คืนเงิน/i;

export const kbankLayout: TableLayoutConfig = {
  bankName: "KBank",
  headerLabels: {
    date: ["date", "วันที่"],
    time: ["time", "เวลา"],
    description: ["descriptions", "รายการ"],
    withdrawal: ["withdrawal", "ถอนเงิน"],
    deposit: ["deposit", "ฝากเงิน"],
    balance: ["balance", "ยอดคงเหลือ"],
    channel: ["channel", "ช่องทาง"],
    details: ["details", "รายละเอียด"],
  },
  requiredColumns: ["date", "description", "amount", "balance", "details"],
  broughtForward: /ยอดยกมา|beginning balance|brought forward/i,
  endOfTable: /issued by k plus|kbpdf|for more information|^total\b|^รวมทั้งสิ้น/i,
  describe: (cells) =>
    [cells.get("description"), cells.get("details")].filter(Boolean).join(" "),
  directionFromText: (cells) =>
    INCOMING.test(`${cells.get("description") ?? ""} ${cells.get("details") ?? ""}`) ? "in" : "out",
};

/** Parse already-extracted PDF text. Exported for unit tests. */
export function parseKbankPages(pages: PdfTextItem[][]): ParsedStatement {
  return parseTableStatement(pages, kbankLayout);
}

export const kbankParser: StatementParser = {
  bankCode: "kbank",
  bankName: "ธนาคารกสิกรไทย (KBank)",
  fileType: "pdf",
  async parse({ data, password }) {
    return parseKbankPages(await readPdfTextItems(data, password));
  },
};
