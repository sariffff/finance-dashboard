// Renders the fictional statement in src/lib/parsers/__fixtures__/
// kbank-sample-data.ts into a password-protected PDF that mimics a KBank
// (K PLUS) statement: DD-MM-YY dates, one amount column for both
// directions, a transaction type plus a details column. Run with:
// npm run fixtures

import { resolve } from "node:path";

import {
  KBANK_FIXTURE_PASSWORD,
  KBANK_OPENING_BALANCE_SATANG,
  kbankRowsWithBalance,
} from "../src/lib/parsers/__fixtures__/kbank-sample-data";

import { PAGE, createFixtureDoc, drawTableHeader, formatBaht, type FixtureColumn } from "./lib/fixture-pdf";

const OUTPUT = resolve("src/lib/parsers/__fixtures__/kbank-statement.pdf");
const ROW_HEIGHT = 16;
const TABLE_TOP = 150;
const TABLE_BOTTOM = 520;

const COLUMNS = {
  date: { x: 30, label: ["วันที่", "Date"] },
  time: { x: 78, label: ["เวลา/วันที่มีผล", "Time/Eff.Date"] },
  type: { x: 145, label: ["รายการ", "Descriptions"] },
  amount: { x: 245, width: 90, label: ["ถอนเงิน / ฝากเงิน", "Withdrawal / Deposit"] },
  balance: { x: 345, width: 90, label: ["ยอดคงเหลือ", "Outstanding Balance"] },
  channel: { x: 450, label: ["ช่องทาง", "Channel"] },
  details: { x: 545, label: ["รายละเอียด", "Details"] },
} satisfies Record<string, FixtureColumn>;

const fixture = createFixtureDoc(OUTPUT, {
  password: KBANK_FIXTURE_PASSWORD,
  title: "Fictional KBank statement for tests",
});
const { doc, write, writeRight } = fixture;

function startPage(pageNumber: number) {
  doc.addPage();
  doc.fontSize(14);
  write("ธนาคารกสิกรไทย", 30, 30, true);
  doc.fontSize(10);
  write("รายการเคลื่อนไหวบัญชีเงินฝาก / Statement of Deposit Account", 30, 52);
  write("ชื่อบัญชี: นางสาว ตัวอย่าง ทดสอบ   เลขที่บัญชี: xxx-x-x5678-x", 30, 70);
  write("ระหว่างวันที่ 01/10/2026 - 31/10/2026", 30, 86);
  write(`หน้า ${pageNumber}`, 760, 30);
  drawTableHeader(fixture, COLUMNS, TABLE_TOP);
}

function endPage() {
  doc.fontSize(8);
  write("Issued by K PLUS  KBPDF  For more information please contact K-Contact Center 02-888-8888", 30, PAGE.height - 40);
}

let page = 1;
let y = TABLE_TOP;
startPage(page);
doc.fontSize(9);
write("ยอดยกมา / Beginning Balance", COLUMNS.date.x, y);
writeRight(formatBaht(KBANK_OPENING_BALANCE_SATANG), COLUMNS.balance.x, COLUMNS.balance.width, y);
y += ROW_HEIGHT;

for (const row of kbankRowsWithBalance()) {
  const height = ROW_HEIGHT * row.details.length;
  if (y + height > TABLE_BOTTOM) {
    endPage();
    startPage(++page);
    y = TABLE_TOP;
  }

  doc.fontSize(9);
  write(row.date, COLUMNS.date.x, y);
  write(row.time, COLUMNS.time.x, y);
  write(row.type, COLUMNS.type.x, y);
  writeRight(row.amount, COLUMNS.amount.x, COLUMNS.amount.width, y);
  writeRight(formatBaht(row.balanceSatang), COLUMNS.balance.x, COLUMNS.balance.width, y);
  write(row.channel, COLUMNS.channel.x, y);
  row.details.forEach((line, index) => {
    write(line, COLUMNS.details.x, y + index * ROW_HEIGHT);
  });
  y += height;
}

endPage();
doc.end();

console.log(`Wrote ${OUTPUT} (${page} pages, password ${KBANK_FIXTURE_PASSWORD})`);
