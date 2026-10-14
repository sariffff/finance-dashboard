const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

/** "2026-09-01" (a calendar date, no timezone) -> "1 ก.ย. 69" */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

/** A moment in time, shown in Bangkok time. */
export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
