import type { ParsedStatement } from "@/lib/parsers/types";

/** What was read from a slip image, before the user confirms it. */
export type SlipDraft = {
  /** False when nothing could be read (no API key, AI failed, not a slip). */
  readByAi: boolean;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM
  amount: string | null; // "1234.50"
  fromName: string | null;
  toName: string | null;
  bank: string | null;
  reference: string | null;
  memo: string | null;
};

/** A pending import's preview: parsed rows, plus the slip draft for slips. */
export type ImportPreview = ParsedStatement & { slip?: SlipDraft };
