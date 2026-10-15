import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PdfPasswordError, type PdfTextItem } from "@/lib/pdf";
import { normalizeThai } from "@/lib/thai";

import { FIXTURE_PASSWORD, expectedTransactions } from "./__fixtures__/scb-sample-data";
import { parseScbPages, scbParser } from "./scb";
import { parseStatementDate } from "./table";
import { StatementFormatError } from "./types";

const fixturePdf = new Uint8Array(
  readFileSync(new URL("./__fixtures__/scb-statement.pdf", import.meta.url)),
);

describe("scbParser with the fixture PDF", () => {
  it("returns every row exactly as generated, across both pages", async () => {
    const result = await scbParser.parse({
      data: fixturePdf,
      password: FIXTURE_PASSWORD,
    });

    expect(result.warnings).toEqual([]);
    expect(result.transactions).toEqual(expectedTransactions());
  });

  it("asks for a password when none is given", async () => {
    await expect(scbParser.parse({ data: fixturePdf })).rejects.toMatchObject(
      new PdfPasswordError("required"),
    );
  });

  it("reports a wrong password", async () => {
    await expect(
      scbParser.parse({ data: fixturePdf, password: "00000000" }),
    ).rejects.toMatchObject(new PdfPasswordError("incorrect"));
  });
});

// Hand-built lines for edge cases the fixture doesn't cover.
function line(y: number, cells: [x: number, text: string][]): PdfTextItem[] {
  return cells.map(([x, str]) => ({ str, x, y, width: str.length * 4 }));
}

const header = line(500, [
  [30, "Date"],
  [85, "Time"],
  [130, "Code"],
  [175, "Channel"],
  [244, "Withdrawal"],
  [347, "Deposit"],
  [444, "Balance"],
  [525, "Description"],
]);

describe("parseScbPages", () => {
  it("rejects files without a statement table", () => {
    expect(() => parseScbPages([line(500, [[30, "Hello"]])])).toThrow(
      StatementFormatError,
    );
  });

  it("falls back to the balance change when the amount column is unclear", () => {
    const { transactions } = parseScbPages([
      [
        ...header,
        ...line(480, [[30, "Balance brought forward"], [464, "1,000.00"]]),
        // Neither amount column is filled in; only the balance moved.
        ...line(460, [[30, "01/09/26"], [85, "10:00"], [464, "1,250.00"], [525, "รับโอน"]]),
      ],
    ]);

    expect(transactions).toMatchObject([
      { direction: "in", amountSatang: 25000, balanceSatang: 125000 },
    ]);
  });

  it("warns when a row disagrees with the running balance", () => {
    const { transactions, warnings } = parseScbPages([
      [
        ...header,
        ...line(480, [[30, "Balance brought forward"], [464, "1,000.00"]]),
        ...line(460, [[30, "01/09/26"], [287, "100.00"], [464, "950.00"], [525, "ร้านค้า"]]),
      ],
    ]);

    expect(transactions).toHaveLength(1);
    expect(warnings).toEqual([expect.stringContaining("ยอดคงเหลือไม่ตรง")]);
  });

  it("reads the real SCB EASY layout: PUA tone marks, signed amounts, page totals", () => {
    // Positions and quirks as extracted from a real statement (made-up rows):
    // the font's tone marks come out as Private Use Area code points.
    const pua = (point: number) => String.fromCodePoint(point);
    const realHeader = line(661, [
      [57, "วันที่"],
      [101, "เวลา"],
      [132, "รายการ"],
      [175, `ช${pua(0xf70a)}องทาง`],
      [233, "รายละเอียด"],
      [306, "หมายเลขเช็ค"],
      [371, "ถอน/โอนออก"],
      [445, `ฝาก/โอนเข${pua(0xf70b)}า`],
      [512, "ยอดคงเหลือ"],
    ]);
    const { transactions, warnings } = parseScbPages([
      [
        ...realHeader,
        ...line(635, [[49, "01/09/2026"], [97, "17:10:00"], [142, "X2"], [181, "ENET"], [215, "จ่ายบิล ร้านตัวอย่าง"], [407, "-50.00"], [544, "+48.90"]]),
        ...line(616, [[49, "01/09/2026"], [97, "17:18:00"], [142, "X1"], [181, "ENET"], [213, `รับโอนจาก KTB x1234 นาย ทดสอบ`], [470, "+1,100.00"], [536, "+1,148.90"]]),
        ...line(137, [[54, "รวม"], [396, "-50.00"], [467, "+1,100.00"]]),
        ...line(31, [[516, "PAGE 1 of 1"]]),
      ],
    ]);

    expect(warnings).toEqual([]);
    expect(transactions).toEqual([
      { occurredAt: "2026-09-01", occurredTime: "17:10", description: "จ่ายบิล ร้านตัวอย่าง", amountSatang: 5000, direction: "out", balanceSatang: 4890, code: "X2", channel: "ENET" },
      { occurredAt: "2026-09-01", occurredTime: "17:18", description: "รับโอนจาก KTB x1234 นาย ทดสอบ", amountSatang: 110000, direction: "in", balanceSatang: 114890, code: "X1", channel: "ENET" },
    ]);
  });

  it("splits a combined code/channel column", () => {
    const merged = line(500, [
      [30, "วันที่"],
      [85, "เวลา"],
      [130, "รายการ/ช่องทาง"],
      [244, "ถอนเงิน"],
      [347, "ฝากเงิน"],
      [444, "ยอดเงินคงเหลือ"],
      [525, "รายละเอียด"],
    ]);
    const { transactions } = parseScbPages([
      [...merged, ...line(460, [[30, "01/09/26"], [130, "X2 ENET"], [287, "50.00"], [464, "950.00"], [525, "ร้าน"]])],
    ]);

    expect(transactions[0]).toMatchObject({ code: "X2", channel: "ENET" });
  });
});

describe("parseStatementDate", () => {
  it.each([
    ["01/09/26", "2026-09-01"],
    ["01/09/2026", "2026-09-01"],
    ["01/09/69", "2026-09-01"], // Buddhist era, 2-digit
    ["01/09/2569", "2026-09-01"], // Buddhist era, 4-digit
    ["29/02/24", "2024-02-29"],
  ])("parses %j as %j", (input, expected) => {
    expect(parseStatementDate(input)).toBe(expected);
  });

  it.each(["31/02/26", "1/13/26", "2026-09-01", ""])("rejects %j", (input) => {
    expect(parseStatementDate(input)).toBeNull();
  });
});

describe("normalizeThai", () => {
  it.each([
    ["จํากัด", "จำกัด"], // NIKHAHIT + SARA AA
    ["นํ้า", "น้ำ"], // with a tone mark in between
    ["จำากัด", "จำกัด"], // stray SARA AA after SARA AM
    ["  ร้าน   ค้า ", "ร้าน ค้า"],
  ])("normalizes %j", (input, expected) => {
    expect(normalizeThai(input)).toBe(expected);
  });
});
