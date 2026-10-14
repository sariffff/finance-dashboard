import { scbParser } from "./scb";
import type { StatementParser } from "./types";

export const parsers = {
  scb: scbParser,
} satisfies Record<string, StatementParser>;

export type BankCode = keyof typeof parsers;

export const bankCodes = Object.keys(parsers) as [BankCode, ...BankCode[]];

export function getParser(bankCode: string): StatementParser | undefined {
  return parsers[bankCode as BankCode];
}
