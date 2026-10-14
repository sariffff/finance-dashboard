import { parseAmountToSatang } from "@/lib/money";
import {
  groupIntoLines,
  joinItems,
  readPdfTextItems,
  type PdfLine,
  type PdfTextItem,
} from "@/lib/pdf";
import { normalizeThai } from "@/lib/thai";

import {
  StatementFormatError,
  type ParsedStatement,
  type ParsedTransaction,
  type StatementParser,
} from "./types";

// SCB e-Statement (PDF) parser.
//
// The layout is based on public information about SCB statements (column
// headers วันที่ / เวลา / รายการ / ช่องทาง / ถอนเงิน / ฝากเงิน / ยอดเงินคงเหลือ
// / รายละเอียด, with English equivalents) — it has not yet been checked
// against a real statement, so it locates columns from the header text
// instead of hard-coding x positions, and cross-checks every row against the
// running balance.

type ColumnKey =
  | "date"
  | "time"
  | "code"
  | "channel"
  | "withdrawal"
  | "deposit"
  | "balance"
  | "description";

const HEADER_LABELS: Record<ColumnKey, string[]> = {
  date: ["date", "วันที่"],
  time: ["time", "เวลา"],
  code: ["code", "รายการ"],
  channel: ["channel", "ช่องทาง"],
  withdrawal: ["withdrawal", "ถอนเงิน"],
  deposit: ["deposit", "ฝากเงิน"],
  balance: ["balance", "ยอดเงินคงเหลือ"],
  description: ["description", "รายละเอียด"],
};

const REQUIRED_COLUMNS: ColumnKey[] = [
  "date",
  "withdrawal",
  "deposit",
  "balance",
  "description",
];

type Column = { key: ColumnKey; x: number; center: number };

type Layout = {
  columns: Column[];
  /** Left edge of the description column; anything right of it is text. */
  descriptionX: number;
  /** Code and channel share one header, e.g. "รายการ/ช่องทาง". */
  codeChannelMerged: boolean;
};

const DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;
const BROUGHT_FORWARD = /ยกมา|brought forward/i;
const END_OF_TABLE = /www\.scb\.co\.th|^total\b|^รวมทั้งสิ้น/i;
const COLUMN_TOLERANCE = 2;

/**
 * Statement dates are DD/MM/YY or DD/MM/YYYY, in either the Gregorian or
 * the Buddhist era (BE = CE + 543). Two-digit years of 60 and above are
 * read as BE (e.g. "69" = 2569 = 2026); below 60 as CE (e.g. "26" = 2026).
 */
export function parseStatementDate(text: string): string | null {
  const match = DATE_PATTERN.exec(text.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (match[3].length === 2) {
    year = year >= 60 ? 2500 + year - 543 : 2000 + year;
  } else if (year > 2400) {
    year -= 543;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function findLayout(line: PdfLine): Layout | null {
  const found = new Map<ColumnKey, PdfTextItem>();

  for (const item of line.items) {
    const text = normalizeThai(item.str).toLowerCase();
    for (const [key, labels] of Object.entries(HEADER_LABELS) as [
      ColumnKey,
      string[],
    ][]) {
      if (!found.has(key) && labels.some((label) => text.includes(label))) {
        found.set(key, item);
      }
    }
  }

  if (!REQUIRED_COLUMNS.every((key) => found.has(key))) return null;

  const codeChannelMerged =
    found.has("code") && found.get("code") === found.get("channel");
  if (codeChannelMerged) found.delete("channel");

  const columns = [...found].map(([key, item]) => ({
    key,
    x: item.x,
    center: item.x + item.width / 2,
  }));

  return {
    columns,
    descriptionX: found.get("description")!.x,
    codeChannelMerged,
  };
}

function columnFor(item: PdfTextItem, layout: Layout): ColumnKey {
  if (item.x >= layout.descriptionX - COLUMN_TOLERANCE) return "description";

  const center = item.x + item.width / 2;
  let best: Column | undefined;
  for (const column of layout.columns) {
    if (column.key === "description") continue;
    if (!best || Math.abs(column.center - center) < Math.abs(best.center - center)) {
      best = column;
    }
  }
  return best!.key;
}

function cellsOf(line: PdfLine, layout: Layout): Map<ColumnKey, string> {
  const itemsByColumn = new Map<ColumnKey, PdfTextItem[]>();
  for (const item of line.items) {
    const key = columnFor(item, layout);
    itemsByColumn.set(key, [...(itemsByColumn.get(key) ?? []), item]);
  }

  const cells = new Map<ColumnKey, string>();
  for (const [key, items] of itemsByColumn) {
    cells.set(key, normalizeThai(joinItems(items)));
  }
  return cells;
}

function parseOptionalAmount(text: string | undefined): number | null {
  if (!text || text === "-" || text === "") return null;
  return parseAmountToSatang(text);
}

function lastAmountIn(line: PdfLine): number | null {
  for (const item of [...line.items].reverse()) {
    try {
      return parseAmountToSatang(item.str);
    } catch {
      // not a number — keep looking
    }
  }
  return null;
}

/** Parse already-extracted PDF text. Exported for unit tests. */
export function parseScbPages(pages: PdfTextItem[][]): ParsedStatement {
  const transactions: ParsedTransaction[] = [];
  const warnings: string[] = [];
  let sawHeader = false;
  let previousBalance: number | null = null;

  for (const page of pages) {
    let layout: Layout | null = null;
    let inTable = false;
    // Continuation lines only attach to a row from the same table section.
    let last: ParsedTransaction | null = null;

    for (const line of groupIntoLines(page)) {
      const text = normalizeThai(joinItems(line.items));

      const headerLayout = findLayout(line);
      if (headerLayout) {
        // Bilingual statements repeat the header in Thai and English;
        // keep the first so both lines don't reset state twice.
        layout ??= headerLayout;
        inTable = sawHeader = true;
        continue;
      }
      if (!layout || !inTable) continue;

      if (END_OF_TABLE.test(text)) {
        inTable = false;
        last = null;
        continue;
      }

      if (BROUGHT_FORWARD.test(text)) {
        previousBalance = lastAmountIn(line);
        continue;
      }

      const cells = cellsOf(line, layout);
      const date = parseStatementDate(cells.get("date") ?? "");

      if (!date) {
        // A wrapped description: every item sits in the description column.
        if (last && [...cells.keys()].every((key) => key === "description")) {
          last.description = `${last.description} ${cells.get("description")}`;
        }
        continue;
      }

      const rowNumber = transactions.length + 1;
      let withdrawal: number | null;
      let deposit: number | null;
      let balance: number | null;
      try {
        withdrawal = parseOptionalAmount(cells.get("withdrawal"));
        deposit = parseOptionalAmount(cells.get("deposit"));
        balance = parseOptionalAmount(cells.get("balance"));
      } catch {
        warnings.push(`ข้ามรายการวันที่ ${cells.get("date")}: อ่านจำนวนเงินไม่ได้`);
        continue;
      }

      let direction: "in" | "out";
      let amount: number;
      const balanceChange =
        previousBalance !== null && balance !== null
          ? balance - previousBalance
          : null;

      if (withdrawal !== null && deposit === null) {
        direction = "out";
        amount = withdrawal;
      } else if (deposit !== null && withdrawal === null) {
        direction = "in";
        amount = deposit;
      } else if (balanceChange !== null && balanceChange !== 0) {
        direction = balanceChange > 0 ? "in" : "out";
        amount = Math.abs(balanceChange);
      } else {
        warnings.push(`ข้ามรายการวันที่ ${cells.get("date")}: ไม่รู้ว่าเป็นเงินเข้าหรือออก`);
        continue;
      }

      if (
        balanceChange !== null &&
        balanceChange !== (direction === "in" ? amount : -amount)
      ) {
        warnings.push(
          `รายการที่ ${rowNumber} (${cells.get("date")}): ยอดคงเหลือไม่ตรงกับจำนวนเงิน กรุณาตรวจสอบ`,
        );
      }

      let code = cells.get("code") ?? null;
      let channel = cells.get("channel") ?? null;
      if (layout.codeChannelMerged && code) {
        const [first, ...rest] = code.split(" ");
        code = first;
        channel = rest.join(" ") || null;
      }

      const time = TIME_PATTERN.exec(cells.get("time") ?? "");
      last = {
        occurredAt: date,
        occurredTime: time ? `${time[1].padStart(2, "0")}:${time[2]}` : null,
        description: cells.get("description") ?? "",
        amountSatang: amount,
        direction,
        balanceSatang: balance,
        code,
        channel,
      };
      transactions.push(last);
      if (balance !== null) previousBalance = balance;
    }
  }

  if (!sawHeader) {
    throw new StatementFormatError(
      "ไม่พบตารางรายการในไฟล์ — ไฟล์นี้อาจไม่ใช่ statement ของ SCB",
    );
  }
  return { transactions, warnings };
}

export const scbParser: StatementParser = {
  bankCode: "scb",
  bankName: "ธนาคารไทยพาณิชย์ (SCB)",
  fileType: "pdf",
  async parse({ data, password }) {
    const pages = await readPdfTextItems(data, password);
    return parseScbPages(pages);
  },
};
