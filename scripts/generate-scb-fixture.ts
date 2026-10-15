// Renders the fictional statement in src/lib/parsers/__fixtures__/
// scb-sample-data.ts into a password-protected PDF that mimics the layout of
// a real SCB e-Statement from the SCB EASY app (checked 2026-10): a single
// Thai header row, the description before the amounts, signed amounts and
// balance, DD/MM/YYYY dates, times with seconds, and a "รวม" totals row on
// every page. Run with: npm run fixtures

import { resolve } from "node:path";

import {
  FIXTURE_PASSWORD,
  fixtureRowsWithBalance,
} from "../src/lib/parsers/__fixtures__/scb-sample-data";

import { PAGE, createFixtureDoc, formatBaht, type FixtureColumn } from "./lib/fixture-pdf";

const OUTPUT = resolve("src/lib/parsers/__fixtures__/scb-statement.pdf");
const ROW_HEIGHT = 19;
const TABLE_TOP = 175;
const ROWS_PER_PAGE = 18;

// x positions as on the real statement; amounts are right-aligned in `width`.
const COLUMNS = {
  date: { x: 49, label: ["วันที่", ""] },
  time: { x: 97, label: ["เวลา", ""] },
  code: { x: 132, label: ["รายการ", ""] },
  channel: { x: 175, label: ["ช่องทาง", ""] },
  description: { x: 212, label: ["รายละเอียด", ""] },
  cheque: { x: 306, label: ["หมายเลขเช็ค", ""] },
  withdrawal: { x: 365, width: 65, label: ["ถอน/โอนออก", ""] },
  deposit: { x: 440, width: 65, label: ["ฝาก/โอนเข้า", ""] },
  balance: { x: 510, width: 68, label: ["ยอดคงเหลือ", ""] },
} satisfies Record<string, FixtureColumn>;
// The description cell starts left of its centered header, as in the original.
const DESCRIPTION_HEADER_X = 233;

const fixture = createFixtureDoc(OUTPUT, {
  password: FIXTURE_PASSWORD,
  title: "Fictional SCB statement for tests",
});
const { doc, write, writeRight } = fixture;

const rows = fixtureRowsWithBalance();
// Split into pages by printed lines (a wrapped description takes two).
const pages: (typeof rows)[] = [[]];
let linesOnPage = 0;
for (const row of rows) {
  if (linesOnPage + row.description.length > ROWS_PER_PAGE) {
    pages.push([]);
    linesOnPage = 0;
  }
  pages.at(-1)!.push(row);
  linesOnPage += row.description.length;
}

const signed = (sign: "-" | "+", baht: string) => `${sign}${baht}`;
const fullYear = (ddmmyy: string) => ddmmyy.replace(/\/(\d{2})$/, "/20$1");

pages.forEach((pageRows, pageIndex) => {
  doc.addPage();
  doc.fontSize(9);
  write("รายการบัญชี", 39, 40);
  write("เงินฝากออมทรัพย์ (ออนไลน์ แอพ)", 95, 40);
  write("เดือน", 39, 57);
  write("กันยายน 2569", 68, 57);
  write("ชื่อบัญชี", 39, 74);
  write("นาย ตัวอย่าง ทดสอบ", 130, 74);
  write("เลขที่บัญชี", 39, 91);
  write("XXXX001234", 130, 91);

  doc.fontSize(8);
  for (const [key, column] of Object.entries(COLUMNS)) {
    write(column.label[0], key === "description" ? DESCRIPTION_HEADER_X : column.x, TABLE_TOP - 30, true);
  }
  doc.moveTo(39, TABLE_TOP - 14).lineTo(580, TABLE_TOP - 14).stroke();

  let y = TABLE_TOP;
  let pageOut = 0;
  let pageIn = 0;
  doc.fontSize(8);
  for (const row of pageRows) {
    const deposit = row.code === "X1";
    if (deposit) pageIn += row.amountSatang;
    else pageOut += row.amountSatang;

    write(fullYear(row.date), COLUMNS.date.x, y);
    write(`${row.time}:00`, COLUMNS.time.x, y);
    write(row.code, COLUMNS.code.x + 10, y);
    write(row.channel, COLUMNS.channel.x + 6, y);
    row.description.forEach((text, index) => write(text, COLUMNS.description.x, y + index * ROW_HEIGHT));
    const column = deposit ? COLUMNS.deposit : COLUMNS.withdrawal;
    writeRight(signed(deposit ? "+" : "-", row.amount), column.x, column.width, y);
    writeRight(signed("+", formatBaht(row.balanceSatang)), COLUMNS.balance.x, COLUMNS.balance.width, y);
    y += ROW_HEIGHT * row.description.length;
  }

  // Page totals, notes and page number, as on the real statement.
  y += 8;
  write("รวม", 54, y, true);
  writeRight(signed("-", formatBaht(pageOut)), COLUMNS.withdrawal.x - 10, COLUMNS.withdrawal.width, y);
  writeRight(signed("+", formatBaht(pageIn)), COLUMNS.deposit.x - 10, COLUMNS.deposit.width, y);
  write("หมายเหตุ", 37, y + 32);
  write("กรณีที่ข้อมูลในเอกสารฉบับนี้ไม่ตรงกับข้อมูลในระบบของธนาคาร ให้ถือว่าข้อมูลในระบบของธนาคารเป็นข้อมูลที่ถูกต้อง", 82, y + 32);
  write(`PAGE ${pageIndex + 1} of ${pages.length}`, 516, PAGE.height - 31);
});

doc.end();
console.log(`Wrote ${OUTPUT} (${pages.length} pages, password ${FIXTURE_PASSWORD})`);
