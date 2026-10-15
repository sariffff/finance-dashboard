import { sql } from "drizzle-orm";
import { connection, NextResponse } from "next/server";

import { db } from "@/db";

// Health check for Docker / load balancers: 200 when the app can reach the
// database, 503 when it can't. Reveals nothing about the data.
export async function GET() {
  // Always answer at request time, never from a build-time prerender.
  await connection();

  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { status: "database unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
