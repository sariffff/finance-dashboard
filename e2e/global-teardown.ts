import postgres from "postgres";

import { E2E_EMAIL_DOMAIN } from "./helpers";

// Remove the throwaway users the tests signed up. Their sessions, bank
// accounts, imports and transactions go with them (ON DELETE CASCADE).
export default async function globalTeardown() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const sql = postgres(url, { max: 1 });
  try {
    await sql`delete from "user" where email like ${`%@${E2E_EMAIL_DOMAIN}`}`;
  } finally {
    await sql.end();
  }
}
