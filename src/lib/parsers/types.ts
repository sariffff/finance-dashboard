// Shared contract for every bank statement parser. Adding a bank means adding
// one module in this folder that exports a StatementParser and registering it
// in ./index.ts — nothing else in the import flow has to change.

export type ParsedTransaction = {
  /** Calendar date as printed on the statement (Asia/Bangkok), YYYY-MM-DD. */
  occurredAt: string;
  /** HH:MM when the statement shows a time. */
  occurredTime: string | null;
  description: string;
  /** Always positive; the sign lives in `direction`. */
  amountSatang: number;
  direction: "in" | "out";
  /** Running balance after this transaction, when the statement shows it. */
  balanceSatang: number | null;
  /** Bank's transaction code, e.g. SCB "X1" / "X2". */
  code: string | null;
  /** Channel such as ENET, ATM, BCMS. */
  channel: string | null;
};

export type ParsedStatement = {
  transactions: ParsedTransaction[];
  /** Non-fatal problems worth showing on the preview, in Thai. */
  warnings: string[];
};

export type StatementInput = {
  data: Uint8Array;
  /** PDF password. Used once to decrypt; never stored or logged. */
  password?: string;
};

export type StatementParser = {
  bankCode: string;
  bankName: string;
  fileType: "pdf" | "csv";
  parse(input: StatementInput): Promise<ParsedStatement>;
};

/** The file was read but doesn't look like a statement this parser knows. */
export class StatementFormatError extends Error {
  override name = "StatementFormatError";
}
