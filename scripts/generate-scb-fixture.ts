// Renders the fictional statement in src/lib/parsers/__fixtures__/
// scb-sample-data.ts into a password-protected PDF that mimics the layout of
// an SCB e-Statement. Run with: npm run fixtures

import { resolve } from "node:path";

import {
  FIXTURE_PASSWORD,
  OPENING_BALANCE_SATANG,
  fixtureRowsWithBalance,
} from "../src/lib/parsers/__fixtures__/scb-sample-data";

import { PAGE, createFixtureDoc, drawTableHeader, formatBaht, type FixtureColumn } from "./lib/fixture-pdf";

const OUTPUT = resolve("src/lib/parsers/__fixtures__/scb-statement.pdf");
const ROW_HEIGHT = 16;
const TABLE_TOP = 150;
const TABLE_BOTTOM = 520;

// x positions; amounts are right-aligned inside `width`.
const COLUMNS = {
  date: { x: 30, label: ["วันที่", "Date"] },
  time: { x: 85, label: ["เวลา", "Time"] },
  code: { x: 130, label: ["รายการ", "Code"] },
  channel: { x: 175, label: ["ช่องทาง", "Channel"] },
  withdrawal: { x: 225, width: 85, label: ["ถอนเงิน/หักบัญชี", "Withdrawal"] },
  deposit: { x: 320, width: 85, label: ["ฝากเงิน/เข้าบัญชี", "Deposit"] },
  balance: { x: 415, width: 90, label: ["ยอดเงินคงเหลือ", "Balance"] },
  description: { x: 525, label: ["รายละเอียด", "Description"] },
} satisfies Record<string, FixtureColumn>;

const fixture = createFixtureDoc(OUTPUT, {
  password: FIXTURE_PASSWORD,
  title: "Fictional SCB statement for tests",
});
const { doc, write, writeRight } = fixture;

function startPage(pageNumber: number) {
  doc.addPage();
  doc.fontSize(14);
  write("ธนาคารไทยพาณิชย์ จำกัด (มหาชน)", 30, 30, true);
  doc.fontSize(10);
  write("รายการเดินบัญชี / Statement of Account", 30, 52);
  write("ชื่อบัญชี: นาย ตัวอย่าง ทดสอบ   เลขที่บัญชี: xxx-x-x1234-x", 30, 70);
  write("รอบระหว่างวันที่ 01/09/2026 - 30/09/2026", 30, 86);
  write(`หน้า ${pageNumber}`, 760, 30);
  drawTableHeader(fixture, COLUMNS, TABLE_TOP);
}

function endPage() {
  doc.fontSize(8);
  write("www.scb.co.th  SCB Call Center 02-777-7777", 30, PAGE.height - 40);
}

let page = 1;
let y = TABLE_TOP;
startPage(page);
doc.fontSize(9);
write("ยอดเงินคงเหลือยกมา / Balance brought forward", COLUMNS.date.x, y);
writeRight(formatBaht(OPENING_BALANCE_SATANG), COLUMNS.balance.x, COLUMNS.balance.width, y);
y += ROW_HEIGHT;

for (const row of fixtureRowsWithBalance()) {
  const height = ROW_HEIGHT * row.description.length;
  if (y + height > TABLE_BOTTOM) {
    endPage();
    startPage(++page);
    y = TABLE_TOP;
  }

  doc.fontSize(9);
  write(row.date, COLUMNS.date.x, y);
  write(row.time, COLUMNS.time.x, y);
  write(row.code, COLUMNS.code.x, y);
  write(row.channel, COLUMNS.channel.x, y);
  const amountColumn = row.code === "X1" ? COLUMNS.deposit : COLUMNS.withdrawal;
  writeRight(row.amount, amountColumn.x, amountColumn.width, y);
  writeRight(formatBaht(row.balanceSatang), COLUMNS.balance.x, COLUMNS.balance.width, y);
  row.description.forEach((line, index) => {
    write(line, COLUMNS.description.x, y + index * ROW_HEIGHT);
  });
  y += height;
}

doc.fontSize(9);
write("Total amount / รวมทั้งสิ้น", COLUMNS.date.x, y + 8, true);
endPage();
doc.end();

console.log(`Wrote ${OUTPUT} (${page} pages, password ${FIXTURE_PASSWORD})`);
