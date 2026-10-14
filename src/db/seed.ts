import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";

import { categories, type NewCategory } from "./schema";

// Built-in categories shared by every user (userId = null).
// `icon` is a lucide-react icon name, used by shadcn/ui in the UI.
const defaultCategories: NewCategory[] = [
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

async function main() {
  // Own short-lived client so the script can close it and exit.
  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    // Safe to run repeatedly: the (userId, name) unique constraint skips
    // categories that already exist.
    const inserted = await db
      .insert(categories)
      .values(defaultCategories.map((c) => ({ ...c, userId: null })))
      .onConflictDoNothing()
      .returning({ id: categories.id });

    console.log(
      `Seeded categories: ${inserted.length} inserted, ` +
        `${defaultCategories.length - inserted.length} already present`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
