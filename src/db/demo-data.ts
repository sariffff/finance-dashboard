import { addMonths } from "@/lib/month";

// Fictional but realistic history for the shared demo account: a salaried
// office worker in Bangkok with a main SCB account and a KBANK account for
// freelance income and groceries. Pure and deterministic — every month is
// generated from its own seed, so a given month looks the same on every run
// (screenshots stay valid) and only the "today" cut-off moves.

export type DemoAccount = "scb" | "kbank";

export type DemoTransaction = {
  account: DemoAccount;
  occurredAt: string; // YYYY-MM-DD (Bangkok calendar date)
  occurredTime: string; // HH:MM
  description: string;
  amountSatang: number;
  direction: "in" | "out";
  /**
   * What a categorizer should answer for descriptions the system rules don't
   * cover: the category name, and the merchant to cache (null for transfers
   * to people). Undefined = the system rules handle it, or (for the few
   * `unknown` rows) nobody can tell — those stay "ยังไม่จัดหมวด" on purpose.
   */
  ai?: { categoryName: string; merchant: string | null };
};

type Spec = Omit<DemoTransaction, "account" | "occurredAt" | "occurredTime" | "amountSatang"> & {
  /** Baht range [min, max]; amounts are drawn in whole satang. */
  baht: [number, number];
  /** Round to whole baht (most QR/shop payments are). */
  whole?: boolean;
};

// mulberry32: tiny seeded PRNG, good enough for fake data.
function createRandom(seed: string) {
  let state = 0;
  for (const char of seed) state = (Math.imul(state, 31) + char.charCodeAt(0)) | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

function daysInMonth(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

const food = (merchant: string) => ({ categoryName: "อาหารและเครื่องดื่ม", merchant });

// Recurring small spending, drawn several times a month.
const everyday: { spec: Spec; perMonth: [number, number]; hours: [number, number] }[] = [
  { spec: { description: "โอนไป PromptPay ร้านกาแฟดีดี", direction: "out", baht: [55, 75], whole: true, ai: food("ร้านกาแฟดีดี") }, perMonth: [10, 16], hours: [7, 9] },
  { spec: { description: "7-ELEVEN สาขาอโศก", direction: "out", baht: [35, 260] }, perMonth: [6, 12], hours: [7, 22] },
  { spec: { description: "ร้านข้าวมันไก่ประตูน้ำ", direction: "out", baht: [60, 90], whole: true, ai: food("ร้านข้าวมันไก่ประตูน้ำ") }, perMonth: [3, 6], hours: [11, 13] },
  { spec: { description: "ร้านก๋วยเตี๋ยวเรือ", direction: "out", baht: [60, 120], whole: true, ai: food("ร้านก๋วยเตี๋ยวเรือ") }, perMonth: [2, 5], hours: [11, 13] },
  { spec: { description: "ร้านอาหารส้มตำนัว", direction: "out", baht: [180, 650], whole: true, ai: food("ร้านอาหารส้มตำนัว") }, perMonth: [1, 3], hours: [18, 20] },
  { spec: { description: "GRAB FOOD ค่าอาหาร", direction: "out", baht: [120, 380] }, perMonth: [3, 7], hours: [18, 21] },
  { spec: { description: "LINE MAN ค่าอาหาร", direction: "out", baht: [110, 320] }, perMonth: [2, 5], hours: [11, 21] },
  { spec: { description: "BTS SKYTRAIN เติมเงินบัตรแรบบิท", direction: "out", baht: [100, 300], whole: true }, perMonth: [3, 5], hours: [7, 9] },
  { spec: { description: "MRT เติมเงินบัตร", direction: "out", baht: [100, 200], whole: true }, perMonth: [1, 3], hours: [7, 9] },
  { spec: { description: "GRAB* ค่าเดินทาง", direction: "out", baht: [85, 260] }, perMonth: [1, 4], hours: [17, 23] },
  { spec: { description: "SHOPEEPAY ช้อปปิ้งออนไลน์", direction: "out", baht: [150, 1_200] }, perMonth: [1, 3], hours: [20, 23] },
  { spec: { description: "LAZADA ช้อปปิ้งออนไลน์", direction: "out", baht: [200, 1_500] }, perMonth: [0, 2], hours: [20, 23] },
];

export type GenerateOptions = {
  /** Last month to generate, "YYYY-MM". */
  endMonth: string;
  /** How many months, ending with endMonth. */
  months: number;
  /** Nothing is generated after this date (YYYY-MM-DD). */
  today: string;
};

export function generateDemoTransactions({ endMonth, months, today }: GenerateOptions): DemoTransaction[] {
  const all: DemoTransaction[] = [];
  for (let i = months - 1; i >= 0; i--) {
    all.push(...generateMonth(addMonths(endMonth, -i), i === 0));
  }
  return all
    .filter((tx) => tx.occurredAt <= today)
    .sort((a, b) =>
      a.occurredAt === b.occurredAt
        ? a.occurredTime.localeCompare(b.occurredTime)
        : a.occurredAt.localeCompare(b.occurredAt),
    );
}

function generateMonth(month: string, isLatest: boolean): DemoTransaction[] {
  const random = createRandom(`demo-${month}`);
  const monthNumber = Number(month.slice(5, 7));
  const lastDay = daysInMonth(month);
  const rows: DemoTransaction[] = [];

  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const satang = ([min, max]: [number, number], whole = false) =>
    whole ? int(min, max) * 100 : int(min * 100, max * 100);
  const time = (hours: [number, number]) => `${pad(int(hours[0], hours[1]))}:${pad(int(0, 59))}`;

  const add = (account: DemoAccount, day: number, hours: [number, number], spec: Spec) => {
    const { baht, whole, ...rest } = spec;
    rows.push({
      ...rest,
      account,
      occurredAt: `${month}-${pad(Math.min(day, lastDay))}`,
      occurredTime: time(hours),
      amountSatang: satang(baht, whole),
    });
  };

  // ---- Income -------------------------------------------------------------
  // A raise every January makes the 12-month trend chart more interesting.
  const salaryBaht = Math.max(30_000, 38_500 + 3_500 * (Number(month.slice(0, 4)) - 2025));
  add("scb", 25, [0, 0], {
    description: "เงินเดือน บริษัท ตัวอย่าง จำกัด",
    direction: "in",
    baht: [salaryBaht, salaryBaht],
    whole: true,
  });
  if (monthNumber % 2 === 0) {
    add("kbank", int(5, 20), [10, 16], {
      description: "รับโอนจาก บริษัท ลูกค้า ดีไซน์ ค่าออกแบบ",
      direction: "in",
      baht: [3_000, 9_000],
      whole: true,
      ai: { categoryName: "รายได้อื่น", merchant: "บริษัท ลูกค้า ดีไซน์" },
    });
  }
  if (monthNumber === 6 || monthNumber === 12) {
    add("scb", lastDay, [23, 23], { description: "ดอกเบี้ยเงินฝาก", direction: "in", baht: [45, 90] });
  }

  // ---- Fixed monthly bills ------------------------------------------------
  add("scb", 1, [9, 10], {
    description: "โอนไป SCB x1234 ค่าเช่าห้องพัก",
    direction: "out",
    baht: [12_000, 12_000],
    whole: true,
    ai: { categoryName: "ที่พัก", merchant: null },
  });
  // Bangkok's hot season (Mar–May) pushes the electricity bill up.
  const hot = monthNumber >= 3 && monthNumber <= 5;
  add("scb", int(3, 6), [9, 12], {
    description: "ชำระค่าไฟฟ้า การไฟฟ้านครหลวง",
    direction: "out",
    baht: hot ? [1_900, 2_800] : [850, 1_400],
  });
  add("scb", int(3, 8), [9, 12], { description: "ชำระค่าน้ำประปา การประปานครหลวง", direction: "out", baht: [150, 320] });
  add("scb", 11, [9, 12], { description: "TRUE MOVE H ค่าโทรศัพท์", direction: "out", baht: [599, 599], whole: true });
  add("scb", 6, [2, 4], { description: "NETFLIX.COM ค่าสมาชิกรายเดือน", direction: "out", baht: [419, 419], whole: true });
  add("scb", 27, [2, 4], { description: "SPOTIFY ค่าสมาชิก", direction: "out", baht: [159, 159], whole: true });
  add("scb", 28, [6, 7], {
    description: "ANYTIME FITNESS ค่าสมาชิก",
    direction: "out",
    baht: [1_490, 1_490],
    whole: true,
    ai: { categoryName: "สุขภาพ", merchant: "ANYTIME FITNESS" },
  });

  // ---- Everyday spending --------------------------------------------------
  for (const { spec, perMonth, hours } of everyday) {
    const count = int(perMonth[0], perMonth[1]);
    for (let n = 0; n < count; n++) add("scb", int(1, lastDay), hours, spec);
  }
  // Groceries on the KBANK debit card, about weekly.
  for (let n = int(3, 5); n > 0; n--) {
    add("kbank", int(1, lastDay), [10, 20], {
      description: "TOPS MARKET ซื้อของเข้าบ้าน",
      direction: "out",
      baht: [450, 1_600],
      ai: { categoryName: "ช้อปปิ้ง", merchant: "TOPS MARKET" },
    });
  }
  for (let n = int(1, 2); n > 0; n--) {
    add("scb", int(1, lastDay), [14, 18], { description: "PTT STATION เติมน้ำมัน", direction: "out", baht: [500, 1_000], whole: true });
  }
  if (random() < 0.8) {
    add("scb", int(1, lastDay), [13, 21], { description: "MAJOR CINEPLEX ตั๋วหนัง", direction: "out", baht: [220, 560], whole: true });
  }

  // ---- Occasional and seasonal --------------------------------------------
  if (random() < 0.3) {
    add("scb", int(1, lastDay), [9, 16], { description: "โรงพยาบาลตัวอย่าง ค่ารักษา", direction: "out", baht: [600, 3_500] });
  }
  if (monthNumber % 4 === 1) {
    add("scb", int(1, 15), [19, 22], {
      description: "SKILLLANE คอร์สเรียนออนไลน์",
      direction: "out",
      baht: [990, 2_490],
      whole: true,
      ai: { categoryName: "การศึกษา", merchant: "SKILLLANE" },
    });
  }
  // 11.11 / 12.12 sales.
  if (monthNumber === 11 || monthNumber === 12) {
    add("scb", monthNumber, [0, 1], { description: "SHOPEEPAY ช้อปปิ้งออนไลน์", direction: "out", baht: [1_500, 4_500] });
    add("scb", monthNumber, [0, 1], { description: "LAZADA ช้อปปิ้งออนไลน์", direction: "out", baht: [1_000, 3_500] });
  }
  // Songkran trip home.
  if (monthNumber === 4) {
    add("scb", 10, [8, 12], {
      description: "AIRASIA ตั๋วเครื่องบิน",
      direction: "out",
      baht: [2_400, 3_800],
      whole: true,
      ai: { categoryName: "เดินทาง", merchant: "AIRASIA" },
    });
    add("scb", 12, [14, 18], {
      description: "AGODA ค่าที่พัก",
      direction: "out",
      baht: [1_800, 3_200],
      ai: { categoryName: "ที่พัก", merchant: "AGODA" },
    });
  }
  // Birthday dinner in August.
  if (monthNumber === 8) {
    add("scb", 18, [19, 20], {
      description: "บุฟเฟต์ชาบูซอยสุขุมวิท",
      direction: "out",
      baht: [1_800, 2_600],
      whole: true,
      ai: food("บุฟเฟต์ชาบูซอยสุขุมวิท"),
    });
  }

  // ---- Left uncategorized on purpose --------------------------------------
  // Transfers to a phone number say nothing about what they were for; the
  // latest month keeps a few so the demo shows the "ยังไม่จัดหมวด" flow.
  if (isLatest) {
    add("scb", int(1, 5), [12, 20], { description: "โอนไป PromptPay 08x-xxx-4521", direction: "out", baht: [200, 800], whole: true });
    add("scb", int(6, 10), [12, 20], { description: "โอนไป PromptPay 09x-xxx-7788", direction: "out", baht: [150, 500], whole: true });
    add("scb", int(1, 10), [9, 18], { description: "รับโอนจาก PromptPay นาย สมชาย ใจดี", direction: "in", baht: [300, 1_200], whole: true });
  }

  return rows;
}
