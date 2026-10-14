import { parseAmountToSatang } from "@/lib/money";
import { groupIntoLines, joinItems, type PdfLine, type PdfTextItem } from "@/lib/pdf";
import { normalizeThai } from "@/lib/thai";

import { StatementFormatError, type ParsedStatement, type ParsedTransaction } from "./types";

// Generic reader for statement PDFs laid out as a table. A bank parser only
// describes its layout (header labels, markers, how to build the
// description); this module finds the columns from the header text instead
// of hard-coded x positions, and cross-checks every row against the running
// balance.

export type ColumnKey =
  | "date"
  | "time"
  | "code"
  | "channel"
  | "withdrawal"
  | "deposit"
  /** One column for both directions (direction from balance or text). */
  | "amount"
  | "balance"
  | "description"
  | "details";

export type Cells = Map<ColumnKey, string>;

export type TableLayoutConfig = {
  /** Used in error messages, e.g. "SCB". */
  bankName: string;
  /** Lowercase substrings that identify each column's header cell. */
  headerLabels: Partial<Record<ColumnKey, string[]>>;
  /** A line is the table header only if all of these are found. */
  requiredColumns: ColumnKey[];
  /** Line carrying the opening balance, e.g. "ยอดยกมา". */
  broughtForward: RegExp;
  /** Footer lines that end the table on a page. */
  endOfTable: RegExp;
  /** The transaction's description, from the row's text columns. */
  describe(cells: Cells): string;
  /** Direction from the row's text when a single amount column is used. */
  directionFromText?(cells: Cells): "in" | "out" | null;
};

type Column = { key: ColumnKey; x: number; center: number };

type Layout = {
  columns: Column[];
  /** The rightmost column holds free text: anything right of it belongs to it. */
  lastColumn: Column;
  /** Code and channel share one header, e.g. "รายการ/ช่องทาง". */
  codeChannelMerged: boolean;
};

const TEXT_COLUMNS = new Set<ColumnKey>(["description", "details"]);
const DATE_PATTERN = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;
const COLUMN_TOLERANCE = 2;

/**
 * Statement dates are DD/MM/YY, DD-MM-YY or with a 4-digit year, in either
 * the Gregorian or the Buddhist era (BE = CE + 543). Two-digit years of 60
 * and above are read as BE (e.g. "69" = 2569 = 2026); below 60 as CE.
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

function findLayout(line: PdfLine, config: TableLayoutConfig): Layout | null {
  const found = new Map<ColumnKey, PdfTextItem>();

  for (const item of line.items) {
    const text = normalizeThai(item.str).toLowerCase();
    for (const [key, labels] of Object.entries(config.headerLabels) as [ColumnKey, string[]][]) {
      if (!found.has(key) && labels.some((label) => text.includes(label))) {
        found.set(key, item);
      }
    }
  }
  if (!config.requiredColumns.every((key) => found.has(key))) return null;

  // One header naming both directions ("ถอนเงิน / ฝากเงิน") is a single
  // amount column.
  if (found.has("withdrawal") && found.get("withdrawal") === found.get("deposit")) {
    found.set("amount", found.get("withdrawal")!);
    found.delete("withdrawal");
    found.delete("deposit");
  }
  const codeChannelMerged = found.has("code") && found.get("code") === found.get("channel");
  if (codeChannelMerged) found.delete("channel");

  const columns = [...found].map(([key, item]) => ({
    key,
    x: item.x,
    center: item.x + item.width / 2,
  }));
  const lastColumn = columns.reduce((a, b) => (b.x > a.x ? b : a));
  return { columns, lastColumn, codeChannelMerged };
}

function columnFor(item: PdfTextItem, layout: Layout): ColumnKey {
  if (item.x >= layout.lastColumn.x - COLUMN_TOLERANCE) return layout.lastColumn.key;

  const center = item.x + item.width / 2;
  let best: Column | undefined;
  for (const column of layout.columns) {
    if (column === layout.lastColumn) continue;
    if (!best || Math.abs(column.center - center) < Math.abs(best.center - center)) {
      best = column;
    }
  }
  return best!.key;
}

function cellsOf(line: PdfLine, layout: Layout): Cells {
  const itemsByColumn = new Map<ColumnKey, PdfTextItem[]>();
  for (const item of line.items) {
    const key = columnFor(item, layout);
    itemsByColumn.set(key, [...(itemsByColumn.get(key) ?? []), item]);
  }

  const cells: Cells = new Map();
  for (const [key, items] of itemsByColumn) {
    cells.set(key, normalizeThai(joinItems(items)));
  }
  return cells;
}

function parseOptionalAmount(text: string | undefined): number | null {
  if (!text || text === "-") return null;
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

type Row = { transaction: ParsedTransaction; cells: Cells };

/** Parse already-extracted PDF text with a bank's layout config. */
export function parseTableStatement(
  pages: PdfTextItem[][],
  config: TableLayoutConfig,
): ParsedStatement {
  const rows: Row[] = [];
  const warnings: string[] = [];
  let sawHeader = false;
  let previousBalance: number | null = null;

  for (const page of pages) {
    let layout: Layout | null = null;
    let inTable = false;
    // Continuation lines only attach to a row from the same table section.
    let last: Row | null = null;

    for (const line of groupIntoLines(page)) {
      const text = normalizeThai(joinItems(line.items));

      const headerLayout = findLayout(line, config);
      if (headerLayout) {
        // Bilingual statements repeat the header in Thai and English;
        // keep the first so both lines don't reset state twice.
        layout ??= headerLayout;
        inTable = sawHeader = true;
        continue;
      }
      if (!layout || !inTable) continue;

      if (config.endOfTable.test(text)) {
        inTable = false;
        last = null;
        continue;
      }

      if (config.broughtForward.test(text)) {
        previousBalance = lastAmountIn(line);
        continue;
      }

      const cells = cellsOf(line, layout);
      const date = parseStatementDate(cells.get("date") ?? "");

      if (!date) {
        // A wrapped line: every item sits in a free-text column.
        if (last && [...cells.keys()].every((key) => TEXT_COLUMNS.has(key))) {
          for (const [key, value] of cells) {
            const before = last.cells.get(key);
            last.cells.set(key, before ? `${before} ${value}` : value);
          }
          last.transaction.description = config.describe(last.cells);
        }
        continue;
      }

      const label = cells.get("date");
      let withdrawal: number | null;
      let deposit: number | null;
      let single: number | null;
      let balance: number | null;
      try {
        withdrawal = parseOptionalAmount(cells.get("withdrawal"));
        deposit = parseOptionalAmount(cells.get("deposit"));
        single = parseOptionalAmount(cells.get("amount"));
        balance = parseOptionalAmount(cells.get("balance"));
      } catch {
        warnings.push(`ข้ามรายการวันที่ ${label}: อ่านจำนวนเงินไม่ได้`);
        continue;
      }

      const balanceChange =
        previousBalance !== null && balance !== null ? balance - previousBalance : null;

      // Direction, most reliable source first: a dedicated column, the
      // running balance, then the bank's wording.
      let direction: "in" | "out" | null = null;
      let amount: number | null = null;
      if (withdrawal !== null && deposit === null) {
        [direction, amount] = ["out", withdrawal];
      } else if (deposit !== null && withdrawal === null) {
        [direction, amount] = ["in", deposit];
      } else if (balanceChange !== null && balanceChange !== 0) {
        direction = balanceChange > 0 ? "in" : "out";
        amount = single ?? Math.abs(balanceChange);
      } else if (single !== null) {
        direction = config.directionFromText?.(cells) ?? null;
        amount = single;
      }
      if (!direction || amount === null) {
        warnings.push(`ข้ามรายการวันที่ ${label}: ไม่รู้ว่าเป็นเงินเข้าหรือออก`);
        continue;
      }

      if (balanceChange !== null && balanceChange !== (direction === "in" ? amount : -amount)) {
        warnings.push(
          `รายการที่ ${rows.length + 1} (${label}): ยอดคงเหลือไม่ตรงกับจำนวนเงิน กรุณาตรวจสอบ`,
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
        cells,
        transaction: {
          occurredAt: date,
          occurredTime: time ? `${time[1].padStart(2, "0")}:${time[2]}` : null,
          description: config.describe(cells),
          amountSatang: amount,
          direction,
          balanceSatang: balance,
          code,
          channel,
        },
      };
      rows.push(last);
      if (balance !== null) previousBalance = balance;
    }
  }

  if (!sawHeader) {
    throw new StatementFormatError(
      `ไม่พบตารางรายการในไฟล์ — ไฟล์นี้อาจไม่ใช่ statement ของ ${config.bankName}`,
    );
  }
  return { transactions: rows.map((row) => row.transaction), warnings };
}
