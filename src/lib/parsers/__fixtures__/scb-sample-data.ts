import type { ParsedTransaction } from "../types";

// Entirely fictional statement data. scripts/generate-scb-fixture.ts renders
// it into scb-statement.pdf, and the parser test checks that parsing the PDF
// gives back exactly these rows.

export const FIXTURE_PASSWORD = "01011990";
export const OPENING_BALANCE_SATANG = 2_500_000;

export type FixtureRow = {
  date: string; // as printed: DD/MM/YY (Gregorian)
  time: string;
  code: "X1" | "X2";
  channel: string;
  /** Baht with 2 decimals, as printed. */
  amount: string;
  /** One entry per printed line; more than one means a wrapped description. */
  description: string[];
};

export const fixtureRows: FixtureRow[] = [
  { date: "01/09/26", time: "08:12", code: "X2", channel: "ENET", amount: "65.00", description: ["โอนไป PromptPay ร้านกาแฟดีดี"] },
  { date: "01/09/26", time: "12:30", code: "X2", channel: "ENET", amount: "120.00", description: ["จ่ายบิล 7-ELEVEN สาขาสุขุมวิท"] },
  { date: "01/09/26", time: "18:45", code: "X2", channel: "ENET", amount: "89.50", description: ["GRAB* A-ABC123 ค่าเดินทาง"] },
  { date: "02/09/26", time: "08:05", code: "X2", channel: "ENET", amount: "65.00", description: ["โอนไป PromptPay ร้านกาแฟดีดี"] },
  // Same shop, amount and day as the next row: both must survive dedupe.
  { date: "02/09/26", time: "15:20", code: "X2", channel: "ENET", amount: "45.00", description: ["ร้านน้ำปั่นหน้าออฟฟิศ"] },
  { date: "02/09/26", time: "15:20", code: "X2", channel: "ENET", amount: "45.00", description: ["ร้านน้ำปั่นหน้าออฟฟิศ"] },
  { date: "03/09/26", time: "09:00", code: "X2", channel: "BCMS", amount: "1,250.75", description: ["ชำระค่าไฟฟ้า การไฟฟ้านครหลวง"] },
  { date: "03/09/26", time: "20:14", code: "X2", channel: "ENET", amount: "459.00", description: ["SHOPEEPAY ช้อปปิ้งออนไลน์"] },
  { date: "05/09/26", time: "11:11", code: "X1", channel: "ENET", amount: "500.00", description: ["รับโอนจาก PromptPay นาย สมชาย ใจดี"] },
  { date: "05/09/26", time: "13:40", code: "X2", channel: "ATM", amount: "2,000.00", description: ["ถอนเงินสด ATM สาขาอโศก"] },
  { date: "06/09/26", time: "10:22", code: "X2", channel: "ENET", amount: "349.00", description: ["NETFLIX.COM ค่าสมาชิกรายเดือน"] },
  { date: "07/09/26", time: "19:03", code: "X2", channel: "ENET", amount: "780.00", description: ["ร้านอาหารส้มตำนัว"] },
  {
    date: "08/09/26", time: "09:47", code: "X2", channel: "ENET", amount: "15,000.00",
    description: ["โอนไป SCB x1234 นางสาว ตัวอย่าง ทดสอบ", "ค่าเช่าห้องพักเดือนกันยายน"],
  },
  { date: "09/09/26", time: "07:55", code: "X2", channel: "ENET", amount: "42.00", description: ["BTS SKYTRAIN เติมเงินบัตรแรบบิท"] },
  { date: "10/09/26", time: "12:00", code: "X2", channel: "ENET", amount: "135.00", description: ["LINE MAN ค่าอาหาร"] },
  { date: "11/09/26", time: "16:30", code: "X2", channel: "ENET", amount: "599.00", description: ["TRUE MOVE H ค่าโทรศัพท์"] },
  { date: "12/09/26", time: "10:10", code: "X2", channel: "ENET", amount: "1,890.00", description: ["โรงพยาบาลตัวอย่าง ค่ารักษา"] },
  { date: "13/09/26", time: "14:25", code: "X2", channel: "ENET", amount: "220.00", description: ["MAJOR CINEPLEX ตั๋วหนัง"] },
  { date: "14/09/26", time: "09:30", code: "X2", channel: "ENET", amount: "1,045.25", description: ["TOPS MARKET ซื้อของเข้าบ้าน"] },
  { date: "15/09/26", time: "18:00", code: "X2", channel: "ENET", amount: "65.00", description: ["โอนไป PromptPay ร้านกาแฟดีดี"] },
  { date: "16/09/26", time: "08:40", code: "X2", channel: "ENET", amount: "1,500.00", description: ["SKILLLANE คอร์สเรียนออนไลน์"] },
  { date: "17/09/26", time: "21:15", code: "X2", channel: "ENET", amount: "315.00", description: ["LAZADA ช้อปปิ้งออนไลน์"] },
  { date: "18/09/26", time: "12:45", code: "X2", channel: "ENET", amount: "95.00", description: ["ร้านข้าวมันไก่ประตูน้ำ"] },
  { date: "19/09/26", time: "10:05", code: "X1", channel: "ENET", amount: "1,200.00", description: ["รับโอนจาก PromptPay นางสาว ใจงาม มีสุข"] },
  { date: "20/09/26", time: "17:50", code: "X2", channel: "ENET", amount: "650.00", description: ["PTT STATION เติมน้ำมัน"] },
  { date: "22/09/26", time: "09:15", code: "X2", channel: "BCMS", amount: "312.40", description: ["ชำระค่าน้ำประปา การประปานครหลวง"] },
  { date: "23/09/26", time: "13:33", code: "X2", channel: "ENET", amount: "180.00", description: ["ร้านก๋วยเตี๋ยวเรือ"] },
  { date: "24/09/26", time: "08:20", code: "X2", channel: "ENET", amount: "42.00", description: ["BTS SKYTRAIN เติมเงินบัตรแรบบิท"] },
  { date: "25/09/26", time: "00:05", code: "X1", channel: "BCMS", amount: "35,000.00", description: ["เงินเดือน บริษัท ตัวอย่าง จำกัด"] },
  { date: "25/09/26", time: "10:40", code: "X2", channel: "ENET", amount: "5,000.00", description: ["โอนไป KBANK x9876 ออมเงิน"] },
  { date: "26/09/26", time: "19:30", code: "X2", channel: "ENET", amount: "1,280.00", description: ["บุฟเฟต์ชาบูซอยสุขุมวิท"] },
  { date: "27/09/26", time: "11:00", code: "X2", channel: "ENET", amount: "259.00", description: ["SPOTIFY ค่าสมาชิก"] },
  { date: "28/09/26", time: "15:45", code: "X2", channel: "ENET", amount: "75.00", description: ["ร้านขนมปังสดใหม่"] },
  { date: "29/09/26", time: "09:05", code: "X2", channel: "ENET", amount: "65.00", description: ["โอนไป PromptPay ร้านกาแฟดีดี"] },
  { date: "30/09/26", time: "23:59", code: "X1", channel: "BCMS", amount: "12.34", description: ["ดอกเบี้ยเงินฝาก"] },
];

function toSatang(baht: string): number {
  const [whole, fraction] = baht.replace(/,/g, "").split(".");
  return Number(whole) * 100 + Number(fraction);
}

function toIsoDate(ddmmyy: string): string {
  const [dd, mm, yy] = ddmmyy.split("/");
  return `20${yy}-${mm}-${dd}`;
}

/** Rows with the running balance after each one, in satang. */
export function fixtureRowsWithBalance() {
  let balance = OPENING_BALANCE_SATANG;
  return fixtureRows.map((row) => {
    const amount = toSatang(row.amount);
    balance += row.code === "X1" ? amount : -amount;
    return { ...row, amountSatang: amount, balanceSatang: balance };
  });
}

/** What the parser should return for the fixture PDF. */
export function expectedTransactions(): ParsedTransaction[] {
  return fixtureRowsWithBalance().map((row) => ({
    occurredAt: toIsoDate(row.date),
    occurredTime: row.time,
    description: row.description.join(" "),
    amountSatang: row.amountSatang,
    direction: row.code === "X1" ? "in" : "out",
    balanceSatang: row.balanceSatang,
    code: row.code,
    channel: row.channel,
  }));
}
