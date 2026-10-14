import { eq, isNull } from "drizzle-orm";

import { client, db } from "@/db";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { categorizeUncategorized } from "@/lib/categorize";
import { ensureBucket, isStorageConfigured } from "@/lib/storage";

import { createBankAccount, listBankAccounts } from "./queries/bank-accounts";
import { categories, categoryRules, user, type NewCategory } from "./schema";

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

// Built-in rules for common Thai merchants, so they never need the AI.
// Patterns are matched case-insensitively against the description; the
// longest matching pattern wins (e.g. "grab food" before "grab").
const systemRules: { pattern: string; category: string }[] = [
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

async function seedSystemRules() {
  const builtIn = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(isNull(categories.userId));
  const idByName = new Map(builtIn.map((c) => [c.name, c.id]));

  const inserted = await db
    .insert(categoryRules)
    .values(
      systemRules.map(({ pattern, category }) => {
        const categoryId = idByName.get(category);
        if (!categoryId) throw new Error(`Unknown category in system rule: ${category}`);
        return { userId: null, pattern, matchType: "contains" as const, categoryId, source: "system" as const };
      }),
    )
    .onConflictDoNothing()
    .returning({ id: categoryRules.id });

  console.log(
    `System rules: ${inserted.length} inserted, ` +
      `${systemRules.length - inserted.length} already present`,
  );
}

async function seedCategories() {
  // Safe to run repeatedly: the (userId, name) unique constraint skips
  // categories that already exist.
  const inserted = await db
    .insert(categories)
    .values(defaultCategories.map((c) => ({ ...c, userId: null })))
    .onConflictDoNothing()
    .returning({ id: categories.id });

  console.log(
    `Categories: ${inserted.length} inserted, ` +
      `${defaultCategories.length - inserted.length} already present`,
  );
}

async function seedDemoUser() {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, env.DEMO_USER_EMAIL));

  // Go through Better Auth so the password is hashed exactly like a real
  // sign-up and the credential account row is created.
  const demoUserId =
    existing?.id ??
    (
      await auth.api.signUpEmail({
        body: {
          name: "ผู้ใช้ตัวอย่าง",
          email: env.DEMO_USER_EMAIL,
          password: env.DEMO_USER_PASSWORD,
        },
      })
    ).user.id;
  console.log(`Demo user: ${existing ? "already present" : "created"}`);

  // Categorize whatever the demo account already holds, by rules only:
  // seeding should never spend money on API calls.
  const stats = await categorizeUncategorized(demoUserId, { categorizer: null });
  if (stats.byRule > 0) console.log(`Demo transactions categorized by rule: ${stats.byRule}`);

  const accounts = await listBankAccounts(demoUserId);
  if (accounts.length === 0) {
    await createBankAccount(demoUserId, {
      bankCode: "scb",
      nickname: "บัญชีออมทรัพย์ SCB",
    });
    console.log("Demo bank account: created");
  }
}

async function main() {
  try {
    await seedCategories();
    await seedSystemRules();
    await seedDemoUser();
    if (isStorageConfigured()) {
      console.log(`Storage bucket: ${await ensureBucket()}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
