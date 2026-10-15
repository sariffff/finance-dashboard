import type { NewCategory } from "./schema";

// Built-in categories shared by every user (userId = null).
// `icon` is a lucide-react icon name, used by shadcn/ui in the UI.
export const defaultCategories: NewCategory[] = [
  { name: "อาหารและเครื่องดื่ม", icon: "utensils", color: "#f97316", kind: "expense" },
  { name: "เดินทาง", icon: "car", color: "#3b82f6", kind: "expense" },
  { name: "ช้อปปิ้ง", icon: "shopping-bag", color: "#ec4899", kind: "expense" },
  { name: "บิลและสาธารณูปโภค", icon: "receipt", color: "#eab308", kind: "expense" },
  { name: "ที่พัก", icon: "house", color: "#8b5cf6", kind: "expense" },
  { name: "สุขภาพ", icon: "heart-pulse", color: "#ef4444", kind: "expense" },
  { name: "บันเทิง", icon: "clapperboard", color: "#06b6d4", kind: "expense" },
  { name: "การศึกษา", icon: "graduation-cap", color: "#14b8a6", kind: "expense" },
  { name: "โอนเงิน", icon: "arrow-left-right", color: "#64748b", kind: "expense" },
  { name: "อื่น ๆ", icon: "ellipsis", color: "#94a3b8", kind: "expense" },
  { name: "เงินเดือน", icon: "wallet", color: "#22c55e", kind: "income" },
  { name: "รายได้อื่น", icon: "coins", color: "#84cc16", kind: "income" },
];

// Built-in rules for common Thai merchants, so they never need the AI.
// Patterns are matched case-insensitively against the description; the
// longest matching pattern wins (e.g. "grab food" before "grab").
export const systemRules: { pattern: string; category: string }[] = [
  { pattern: "grab food", category: "อาหารและเครื่องดื่ม" },
  { pattern: "grabfood", category: "อาหารและเครื่องดื่ม" },
  { pattern: "line man", category: "อาหารและเครื่องดื่ม" },
  { pattern: "foodpanda", category: "อาหารและเครื่องดื่ม" },
  { pattern: "robinhood", category: "อาหารและเครื่องดื่ม" },
  { pattern: "7-eleven", category: "อาหารและเครื่องดื่ม" },
  { pattern: "grab", category: "เดินทาง" },
  { pattern: "bolt", category: "เดินทาง" },
  { pattern: "bts", category: "เดินทาง" },
  { pattern: "mrt", category: "เดินทาง" },
  { pattern: "ptt station", category: "เดินทาง" },
  { pattern: "shopee", category: "ช้อปปิ้ง" },
  { pattern: "lazada", category: "ช้อปปิ้ง" },
  { pattern: "การไฟฟ้า", category: "บิลและสาธารณูปโภค" },
  { pattern: "การประปา", category: "บิลและสาธารณูปโภค" },
  { pattern: "true move", category: "บิลและสาธารณูปโภค" },
  { pattern: "netflix", category: "บันเทิง" },
  { pattern: "spotify", category: "บันเทิง" },
  { pattern: "major cineplex", category: "บันเทิง" },
  { pattern: "โรงพยาบาล", category: "สุขภาพ" },
  { pattern: "เงินเดือน", category: "เงินเดือน" },
  { pattern: "ดอกเบี้ย", category: "รายได้อื่น" },
];
