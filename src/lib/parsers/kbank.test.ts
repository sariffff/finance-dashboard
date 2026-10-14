import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PdfPasswordError, type PdfTextItem } from "@/lib/pdf";

import { KBANK_FIXTURE_PASSWORD, expectedKbankTransactions } from "./__fixtures__/kbank-sample-data";
import { kbankParser, parseKbankPages } from "./kbank";
import { parseScbPages } from "./scb";
import { StatementFormatError } from "./types";

const fixturePdf = new Uint8Array(
  readFileSync(new URL("./__fixtures__/kbank-statement.pdf", import.meta.url)),
);

describe("kbankParser with the fixture PDF", () => {
  it("returns every row exactly as generated, across both pages", async () => {
    const result = await kbankParser.parse({ data: fixturePdf, password: KBANK_FIXTURE_PASSWORD });
    expect(result.warnings).toEqual([]);
    expect(result.transactions).toEqual(expectedKbankTransactions());
  });

  it("reports a wrong password", async () => {
    await expect(kbankParser.parse({ data: fixturePdf, password: "01011990" })).rejects.toMatchObject(
      new PdfPasswordError("incorrect"),
    );
  });
});

function line(y: number, cells: [x: number, text: string][]): PdfTextItem[] {
  return cells.map(([x, str]) => ({ str, x, y, width: str.length * 4 }));
}

const header = line(500, [
  [30, "Date"],
  [78, "Time"],
  [145, "Descriptions"],
  [248, "Withdrawal / Deposit"],
  [348, "Outstanding Balance"],
  [450, "Channel"],
  [545, "Details"],
]);

describe("parseKbankPages", () => {
  it("falls back to the transaction type when no balance is printed", () => {
    const { transactions } = parseKbankPages([
      [
        ...header,
        ...line(480, [[30, "01-10-26"], [145, "Transfer Deposit"], [300, "500.00"], [545, "From X1234"]]),
        ...line(460, [[30, "02-10-26"], [145, "Payment"], [300, "120.00"], [545, "Paid for Ref XA1"]]),
      ],
    ]);
    expect(transactions.map((t) => [t.direction, t.amountSatang, t.description])).toEqual([
      ["in", 50000, "Transfer Deposit From X1234"],
      ["out", 12000, "Payment Paid for Ref XA1"],
    ]);
  });

  it("trusts the running balance over the wording", () => {
    const { transactions, warnings } = parseKbankPages([
      [
        ...header,
        ...line(480, [[30, "Beginning Balance"], [394, "1,000.00"]]),
        // Worded like a deposit, but the balance went down.
        ...line(460, [[30, "01-10-26"], [145, "Deposit Correction"], [300, "100.00"], [394, "900.00"], [545, "x"]]),
      ],
    ]);
    expect(transactions[0]).toMatchObject({ direction: "out", amountSatang: 10000 });
    expect(warnings).toEqual([]);
  });

  it("doesn't mistake an SCB statement for KBank, or vice versa", async () => {
    const scbPdf = new Uint8Array(
      readFileSync(new URL("./__fixtures__/scb-statement.pdf", import.meta.url)),
    );
    await expect(kbankParser.parse({ data: scbPdf, password: "01011990" })).rejects.toThrow(
      StatementFormatError,
    );
    expect(() => parseScbPages([header])).toThrow(StatementFormatError);
  });
});
