// A "month" is a calendar month string "YYYY-MM". Transaction dates are
// already Bangkok calendar dates (as printed on the statement), so month
// boundaries need no timezone conversion.

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/** First day of the month and first day of the next, for `>= start AND < end`. */
export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${addMonths(month, 1)}-01` };
}

/** The current month in Bangkok time. */
export function currentMonth(now = new Date()): string {
  return currentDate(now).slice(0, 7);
}

/** Today's date in Bangkok time, "YYYY-MM-DD". */
export function currentDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const longFormatter = new Intl.DateTimeFormat("th-TH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortFormatter = new Intl.DateTimeFormat("th-TH", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/** "2026-09" -> "กันยายน 2569" */
export function formatMonth(month: string): string {
  return longFormatter.format(new Date(`${month}-01T00:00:00Z`));
}

/** "2026-09" -> "ก.ย. 69" */
export function formatMonthShort(month: string): string {
  return shortFormatter.format(new Date(`${month}-01T00:00:00Z`));
}
