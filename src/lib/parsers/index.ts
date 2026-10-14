import { kbankParser } from "./kbank";
import { scbParser } from "./scb";
import type { StatementParser } from "./types";

// Adding a bank: write its layout config + parser module, then list it here.
export const parsers = {
  scb: scbParser,
  kbank: kbankParser,
} satisfies Record<string, StatementParser>;

export type BankCode = keyof typeof parsers;

export const bankCodes = Object.keys(parsers) as [BankCode, ...BankCode[]];

export function getParser(bankCode: string): StatementParser | undefined {
  return parsers[bankCode as BankCode];
}
