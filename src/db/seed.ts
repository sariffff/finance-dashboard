import { eq } from "drizzle-orm";

import { client, db } from "@/db";
import { env } from "@/env";
import { auth } from "@/lib/auth";

import { createBankAccount, listBankAccounts } from "./queries/bank-accounts";
import { categories, user, type NewCategory } from "./schema";

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

  // Transactions for the demo account arrive with the import phases.
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
    await seedDemoUser();
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
