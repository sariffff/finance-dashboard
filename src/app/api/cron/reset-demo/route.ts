import { timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";
import { connection, NextResponse } from "next/server";

import { db } from "@/db";
import { resetDemoData } from "@/db/demo-seed";
import { user } from "@/db/schema";
import { env } from "@/env";

// Daily Vercel Cron job (vercel.json): put the shared demo account back to
// its fresh 12-month history ending today. Visitors can import or edit
// anything there; this undoes it and keeps the data current.
// Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is refused.

function isAuthorized(header: string | null): boolean {
  if (!env.CRON_SECRET || !header) return false;
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  await connection();
  if (!isAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [demo] = await db.select({ id: user.id }).from(user).where(eq(user.email, env.DEMO_USER_EMAIL));
  if (!demo) {
    return NextResponse.json({ error: "demo user missing — run npm run db:seed" }, { status: 404 });
  }

  const stats = await resetDemoData(demo.id);
  return NextResponse.json({ status: "ok", ...stats }, { headers: { "Cache-Control": "no-store" } });
}
