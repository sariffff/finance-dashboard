import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";

import * as schema from "./schema";

// Next.js dev server re-evaluates modules on every hot reload. Keeping the
// client on globalThis stops each reload from opening a new connection pool.
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

// Neon's pooled endpoint (host contains "-pooler") runs PgBouncer in
// transaction mode, which can't keep named prepared statements across
// transactions — turn them off there. Direct connections keep them.
const pooled = new URL(env.DATABASE_URL).hostname.includes("-pooler");

export const client =
  globalForDb.pgClient ?? postgres(env.DATABASE_URL, pooled ? { prepare: false } : {});

if (env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
