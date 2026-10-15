import { eq, isNull } from "drizzle-orm";

import { client, db } from "@/db";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { ensureBucket, isStorageConfigured } from "@/lib/storage";

import { resetDemoData } from "./demo-seed";
import { categories, categoryRules, user } from "./schema";
import { defaultCategories, systemRules } from "./seed-data";

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

  // Seeding never spends money on API calls: demo data is categorized by
  // rules and a replay of known answers (see demo-seed.ts).
  const stats = await resetDemoData(demoUserId);
  console.log(
    `Demo data: reset to ${stats.transactions} transactions over ${stats.months} months ` +
      `(${stats.byRule} by rule, ${stats.byAi} by "AI", ${stats.uncategorized} left uncategorized)`,
  );
}

async function main() {
  try {
    await seedCategories();
    await seedSystemRules();
    if (isStorageConfigured()) {
      console.log(`Storage bucket: ${await ensureBucket()}`);
    }
    await seedDemoUser();
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
