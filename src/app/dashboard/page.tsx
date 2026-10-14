import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { signOutAction } from "@/app/(auth)/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getMonthTotals,
  getMonthlyTotals,
  getSpendingByCategory,
  listActiveMonths,
} from "@/db/queries/dashboard";
import { listTransactions } from "@/db/queries/transactions";
import { requireUser } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { formatSatang, parseAmountToSatang } from "@/lib/money";
import { addMonths, currentMonth, formatMonth, formatMonthShort, isMonth } from "@/lib/month";
import { cn } from "@/lib/utils";

import { CategorySpendingChart, MonthlyTrendChart } from "./charts";
import { InsightCard, InsightCardSkeleton } from "./insight-card";
import { MonthPicker } from "./month-picker";

export const metadata: Metadata = { title: "Dashboard — Finance Dashboard" };

const TREND_MONTHS = 6;

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      {/* The session and search params are request data, so the content
          streams in behind Suspense while the static shell renders first. */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  const user = await requireUser();
  const [{ month: requested }, activeMonths] = await Promise.all([
    searchParams,
    listActiveMonths(user.id),
  ]);

  const header = (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">สวัสดี, {user.name}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>
      <nav className="flex flex-wrap gap-2">
        <Link href="/dashboard/import" className={buttonVariants()}>
          นำเข้า statement
        </Link>
        <Link href="/dashboard/transactions" className={buttonVariants({ variant: "outline" })}>
          รายการธุรกรรม
        </Link>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost">
            ออกจากระบบ
          </Button>
        </form>
      </nav>
    </header>
  );

  if (activeMonths.length === 0) {
    return (
      <>
        {header}
        <section className="grid place-items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <h2 className="text-lg font-medium">ยังไม่มีข้อมูล</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            นำเข้า statement ธนาคารเพื่อดูสรุปรายรับรายจ่าย กราฟตามหมวดหมู่ และแนวโน้มรายเดือน
          </p>
          <Link href="/dashboard/import" className={buttonVariants()}>
            นำเข้า statement แรก
          </Link>
        </section>
      </>
    );
  }

  // Default to the newest month with data, not the calendar month, so the
  // page never opens on an empty month.
  const month = isMonth(requested) ? requested : activeMonths[0];
  const monthOptions = [...new Set([currentMonth(), month, ...activeMonths])]
    .sort()
    .reverse()
    .map((value) => ({ value, label: formatMonth(value) }));

  const [totals, previous, spending, trend, recent] = await Promise.all([
    getMonthTotals(user.id, month),
    getMonthTotals(user.id, addMonths(month, -1)),
    getSpendingByCategory(user.id, month),
    getMonthlyTotals(user.id, month, TREND_MONTHS),
    listTransactions(user.id, { month }, { pageSize: 5 }),
  ]);
  const net = totals.inSatang - totals.outSatang;

  return (
    <>
      {header}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">{formatMonth(month)}</h2>
        <MonthPicker months={monthOptions} selected={month} />
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <StatTile label="รายรับ" value={formatSatang(totals.inSatang)} />
        <StatTile
          label="รายจ่าย"
          value={formatSatang(totals.outSatang)}
          note={changeNote(totals.outSatang, previous.outSatang)}
        />
        <StatTile label="คงเหลือ" value={`${net < 0 ? "−" : ""}${formatSatang(Math.abs(net))}`} />
      </dl>

      <Suspense fallback={<InsightCardSkeleton />}>
        <InsightCard userId={user.id} month={month} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>รายจ่ายตามหมวดหมู่</CardTitle>
            <CardDescription>{formatMonth(month)}</CardDescription>
          </CardHeader>
          <CardContent>
            {spending.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีรายจ่ายในเดือนนี้</p>
            ) : (
              <CategorySpendingChart
                data={spending.map((row) => ({
                  name: row.name ?? "ยังไม่จัดหมวด",
                  satang: row.totalSatang,
                  count: row.count,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>แนวโน้ม {TREND_MONTHS} เดือน</CardTitle>
            <CardDescription>
              {formatMonth(trend[0].month)} – {formatMonth(month)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <MonthlyTrendChart
              data={trend.map((row) => ({ ...row, label: formatMonthShort(row.month) }))}
            />
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">ดูเป็นตาราง</summary>
              <table className="mt-2 w-full tabular-nums">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 text-left font-normal">เดือน</th>
                    <th className="py-1 text-right font-normal">รายรับ</th>
                    <th className="py-1 text-right font-normal">รายจ่าย</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((row) => (
                    <tr key={row.month} className="border-t">
                      <td className="py-1">{formatMonth(row.month)}</td>
                      <td className="py-1 text-right">{formatSatang(row.inSatang)}</td>
                      <td className="py-1 text-right">{formatSatang(row.outSatang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>รายการล่าสุด</CardTitle>
          <CardDescription>{recent.total} รายการในเดือนนี้</CardDescription>
          <CardAction>
            <Link
              href={`/dashboard/transactions?month=${month}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              ดูทั้งหมด
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {recent.rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{row.description}</p>
                  <p className="text-muted-foreground">
                    {formatDate(row.occurredAt)} · {row.categoryName ?? "ยังไม่จัดหมวด"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    row.direction === "in" && "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {row.direction === "in" ? "+" : "−"}
                  {formatSatang(parseAmountToSatang(row.amount))}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function changeNote(current: number, previous: number): string | undefined {
  if (previous === 0) return undefined;
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return "เท่ากับเดือนก่อน";
  return `${percent > 0 ? "มากกว่า" : "น้อยกว่า"}เดือนก่อน ${Math.abs(percent)}%`;
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {note && <dd className="mt-1 text-sm text-muted-foreground">{note}</dd>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="กำลังโหลด">
      <div className="h-14 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
