// Money is handled as integer satang (1 baht = 100 satang) in TypeScript and
// stored as numeric(14,2) in PostgreSQL. Never do arithmetic on float baht.

const AMOUNT_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parse a baht amount as written in statements or by users, e.g.
 * "1,234.50", "฿ 99", "-20.5", into integer satang.
 * Throws on anything that is not a valid amount with at most 2 decimals.
 */
export function parseAmountToSatang(input: string): number {
  const cleaned = input.replace(/[,\s฿]/g, "");
  const match = AMOUNT_PATTERN.exec(cleaned);
  if (!match) {
    throw new Error(`Invalid amount: "${input}"`);
  }

  const [, minus, baht, fraction = ""] = match;
  const satang = Number(baht) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(satang)) {
    throw new Error(`Amount out of range: "${input}"`);
  }
  // Avoid returning -0 for "-0.00"
  return minus && satang !== 0 ? -satang : satang;
}

/** Convert integer satang to the decimal string used by numeric columns. */
export function satangToDecimalString(satang: number): string {
  if (!Number.isSafeInteger(satang)) {
    throw new Error(`Satang must be a safe integer, got ${satang}`);
  }
  const sign = satang < 0 ? "-" : "";
  const abs = Math.abs(satang);
  const baht = Math.trunc(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}${baht}.${rest}`;
}

/** Integer satang as "36,712.34" (no currency sign), built from digits only. */
export function formatBahtNumber(satang: number): string {
  const [whole, fraction] = satangToDecimalString(satang).split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  const digits = sign ? whole.slice(1) : whole;
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

const thbFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
});

/** Format integer satang for display, e.g. 123450 -> "฿1,234.50". */
export function formatSatang(satang: number): string {
  return thbFormatter.format(satang / 100);
}
