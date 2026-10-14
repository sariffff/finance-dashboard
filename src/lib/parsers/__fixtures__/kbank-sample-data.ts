import type { ParsedTransaction } from "../types";

// Entirely fictional KBank (K PLUS) statement data for October 2026.
// scripts/generate-kbank-fixture.ts renders it into kbank-statement.pdf, and
// the parser test checks that parsing the PDF gives back exactly these rows.

// K PLUS statement passwords are usually the owner's birth date, DDMMYYYY (CE).
export const KBANK_FIXTURE_PASSWORD = "15061995";
export const KBANK_OPENING_BALANCE_SATANG = 4_215_050;

export type KbankFixtureRow = {
  date: string; // as printed: DD-MM-YY (Gregorian)
  time: string;
  /** KBank's transaction type, e.g. "Transfer Withdrawal". */
  type: string;
  direction: "in" | "out";
  amount: string;
  channel: string;
  /** One entry per printed line; more than one means wrapped details. */
  details: string[];
};

export const kbankFixtureRows: KbankFixtureRow[] = [
  { date: "01-10-26", time: "07:45", type: "Debit Card Spending", direction: "out", amount: "59.00", channel: "EDC", details: ["Ref Code EDC10231 7-ELEVEN สาขาอารีย์"] },
  { date: "01-10-26", time: "12:10", type: "Transfer Withdrawal", direction: "out", amount: "85.00", channel: "K PLUS", details: ["To PromptPay X5521 ร้านกาแฟดีดี"] },
  { date: "02-10-26", time: "18:30", type: "Payment", direction: "out", amount: "1,180.40", channel: "K PLUS", details: ["Paid for Ref XA1B2 การไฟฟ้านครหลวง"] },
  { date: "03-10-26", time: "09:05", type: "Transfer Withdrawal", direction: "out", amount: "65.00", channel: "K PLUS", details: ["To PromptPay X5521 ร้านกาแฟดีดี"] },
  { date: "03-10-26", time: "20:15", type: "Debit Card Spending", direction: "out", amount: "1,290.00", channel: "EDC", details: ["Ref Code EDC10477 CENTRAL WORLD"] },
  { date: "04-10-26", time: "11:20", type: "Transfer Deposit", direction: "in", amount: "800.00", channel: "K PLUS", details: ["From SCB X1234 นาย ตัวอย่าง ทดสอบ"] },
  { date: "05-10-26", time: "13:00", type: "Direct Debit", direction: "out", amount: "599.00", channel: "Automatic Transfer", details: ["Ref Code ODD20311 AIS ค่าบริการรายเดือน"] },
  { date: "06-10-26", time: "08:12", type: "Transfer Withdrawal", direction: "out", amount: "42.00", channel: "K PLUS", details: ["To PromptPay X9910 BTS SKYTRAIN"] },
  { date: "07-10-26", time: "19:40", type: "Debit Card Spending", direction: "out", amount: "325.00", channel: "EDC", details: ["Ref Code EDC10598 MK RESTAURANT"] },
  {
    date: "08-10-26", time: "10:00", type: "Transfer Withdrawal", direction: "out", amount: "15,000.00", channel: "K PLUS",
    details: ["To SCB X7788 นางสาว เจ้าของ ห้องเช่า", "ค่าเช่าห้องเดือนตุลาคม"],
  },
  { date: "09-10-26", time: "12:30", type: "Debit Card Spending", direction: "out", amount: "149.00", channel: "EDC", details: ["Ref Code EDC10630 GRAB FOOD"] },
  { date: "10-10-26", time: "16:45", type: "Payment", direction: "out", amount: "1,499.00", channel: "K PLUS", details: ["Paid for Ref XC3D4 SHOPEE"] },
  { date: "11-10-26", time: "09:30", type: "Cash Withdrawal", direction: "out", amount: "1,000.00", channel: "ATM", details: ["ATM K-Bank สาขาสยาม"] },
  { date: "12-10-26", time: "14:20", type: "Debit Card Spending", direction: "out", amount: "890.00", channel: "EDC", details: ["Ref Code EDC10711 โรงพยาบาลตัวอย่าง"] },
  { date: "13-10-26", time: "21:05", type: "Payment", direction: "out", amount: "419.00", channel: "K PLUS", details: ["Paid for Ref XE5F6 NETFLIX.COM"] },
  { date: "15-10-26", time: "08:50", type: "Transfer Withdrawal", direction: "out", amount: "65.00", channel: "K PLUS", details: ["To PromptPay X5521 ร้านกาแฟดีดี"] },
  { date: "16-10-26", time: "18:10", type: "Debit Card Spending", direction: "out", amount: "2,345.75", channel: "EDC", details: ["Ref Code EDC10802 TOPS MARKET"] },
  { date: "18-10-26", time: "11:11", type: "Transfer Deposit", direction: "in", amount: "1,500.00", channel: "K PLUS", details: ["From KTB X4455 นางสาว เพื่อน ใจดี"] },
  { date: "20-10-26", time: "17:25", type: "Debit Card Spending", direction: "out", amount: "700.00", channel: "EDC", details: ["Ref Code EDC10915 PTT STATION"] },
  { date: "22-10-26", time: "12:00", type: "Debit Card Spending", direction: "out", amount: "120.00", channel: "EDC", details: ["Ref Code EDC10988 ร้านข้าวมันไก่ประตูน้ำ"] },
  { date: "25-10-26", time: "00:10", type: "Payroll", direction: "in", amount: "35,000.00", channel: "Automatic Transfer", details: ["KBANK PAYROLL เงินเดือน บริษัท ตัวอย่าง จำกัด"] },
  { date: "25-10-26", time: "09:00", type: "Transfer Withdrawal", direction: "out", amount: "5,000.00", channel: "K PLUS", details: ["To KBANK X0099 บัญชีเงินออม"] },
  { date: "26-10-26", time: "19:30", type: "Debit Card Spending", direction: "out", amount: "1,180.00", channel: "EDC", details: ["Ref Code EDC11102 MAJOR CINEPLEX"] },
  { date: "28-10-26", time: "15:45", type: "Payment", direction: "out", amount: "315.60", channel: "K PLUS", details: ["Paid for Ref XG7H8 การประปานครหลวง"] },
  { date: "31-10-26", time: "23:59", type: "Interest Deposit", direction: "in", amount: "9.87", channel: "Automatic Transfer", details: ["ดอกเบี้ยเงินฝาก"] },
];

function toSatang(baht: string): number {
  const [whole, fraction] = baht.replace(/,/g, "").split(".");
  return Number(whole) * 100 + Number(fraction);
}

function toIsoDate(ddmmyy: string): string {
  const [dd, mm, yy] = ddmmyy.split("-");
  return `20${yy}-${mm}-${dd}`;
}

/** Rows with the running balance after each one, in satang. */
export function kbankRowsWithBalance() {
  let balance = KBANK_OPENING_BALANCE_SATANG;
  return kbankFixtureRows.map((row) => {
    const amount = toSatang(row.amount);
    balance += row.direction === "in" ? amount : -amount;
    return { ...row, amountSatang: amount, balanceSatang: balance };
  });
}

/** What the parser should return for the fixture PDF. */
export function expectedKbankTransactions(): ParsedTransaction[] {
  return kbankRowsWithBalance().map((row) => ({
    occurredAt: toIsoDate(row.date),
    occurredTime: row.time,
    description: `${row.type} ${row.details.join(" ")}`,
    amountSatang: row.amountSatang,
    direction: row.direction,
    balanceSatang: row.balanceSatang,
    code: null,
    channel: row.channel,
  }));
}
