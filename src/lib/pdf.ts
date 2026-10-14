import { extractTextItems, getDocumentProxy } from "unpdf";

export type PdfTextItem = {
  str: string;
  /** Left edge, PDF units from the left of the page. */
  x: number;
  /** Baseline, PDF units from the bottom of the page. */
  y: number;
  width: number;
};

/** A visual line of text: items sharing a baseline, sorted left to right. */
export type PdfLine = { y: number; items: PdfTextItem[] };

export class PdfPasswordError extends Error {
  override name = "PdfPasswordError";
  constructor(readonly reason: "required" | "incorrect") {
    super(reason === "required" ? "PDF requires a password" : "Incorrect PDF password");
  }
}

// pdf.js PasswordResponses: 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
const INCORRECT_PASSWORD = 2;

/** Extract positioned text from every page. Throws PdfPasswordError. */
export async function readPdfTextItems(
  data: Uint8Array,
  password?: string,
): Promise<PdfTextItem[][]> {
  let doc;
  try {
    // pdf.js takes ownership of (and detaches) the buffer, so pass a copy.
    doc = await getDocumentProxy(new Uint8Array(data), { password });
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") {
      const code = (error as Error & { code?: number }).code;
      throw new PdfPasswordError(
        code === INCORRECT_PASSWORD ? "incorrect" : "required",
      );
    }
    throw error;
  }

  try {
    const { items } = await extractTextItems(doc);
    return items.map((page) =>
      page
        .filter((item) => item.str.trim() !== "")
        .map(({ str, x, y, width }) => ({ str, x, y, width })),
    );
  } finally {
    await doc.loadingTask.destroy();
  }
}

/**
 * Group a page's items into lines, top of the page first. The tolerance is
 * generous because Thai vowels and tone marks (e.g. ำ after ้) can be drawn
 * as separate items a few points above the baseline.
 */
export function groupIntoLines(items: PdfTextItem[], tolerance = 4): PdfLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfLine[] = [];

  for (const item of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - item.y) <= tolerance) {
      line.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines;
}

/**
 * Join items into text. Pieces that touch are parts of one word (PDFs often
 * split Thai words around vowels), so only a visible gap becomes a space.
 */
export function joinItems(items: PdfTextItem[], gap = 1): string {
  let text = "";
  let previousEnd: number | null = null;
  for (const item of items) {
    if (previousEnd !== null && item.x - previousEnd > gap) text += " ";
    text += item.str;
    previousEnd = item.x + item.width;
  }
  return text;
}
