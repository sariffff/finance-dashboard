// Build command on Vercel (see vercel.json).
// Production deploys apply database migrations first, over a direct
// (unpooled) connection: drizzle-kit runs DDL in a transaction, which the
// PgBouncer pooler isn't meant for. Preview deploys skip migrations so a
// branch can never change the production schema.
import { execSync } from "node:child_process";

const run = (command, env = {}) =>
  execSync(command, { stdio: "inherit", env: { ...process.env, ...env } });

if (process.env.VERCEL_ENV === "production") {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — connect the Neon integration first");
  run("npm run db:migrate", { DATABASE_URL: url });
} else {
  console.log(`Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`);
}

run("npm run build");
