import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listBankAccounts } from "@/db/queries/bank-accounts";
import { listCategoriesForUser } from "@/db/queries/categories";
import { listActiveMonths } from "@/db/queries/dashboard";
import { listTransactions, type TransactionFilters } from "@/db/queries/transactions";
import { requireUser } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { formatSatang, parseAmountToSatang } from "@/lib/money";
import { formatMonth, isMonth } from "@/lib/month";
import { cn } from "@/lib/utils";

import { CategoryCell } from "./category-cell";

export const metadata: Metadata = { title: "รายการธุรกรรม — Finance Dashboard" };

const PAGE_SIZE = 25;

// Filters live in the URL, so they survive reloads and can be shared.
// Anything malformed is simply ignored rather than erroring.
const filtersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  month: z.string().refine(isMonth).optional().catch(undefined),
  category: z.union([z.uuid(), z.literal("none")]).optional().catch(undefined),
  account: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});
type Filters = z.infer<typeof filtersSchema>;

export default function TransactionsPage({ searchParams }: PageProps<"/dashboard/transactions">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          ← กลับไปหน้า Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">รายการธุรกรรม</h1>
        <p className="text-sm text-muted-foreground">
          เปลี่ยนหมวดได้ทุกรายการ ระบบจะจำไว้ใช้กับรายการต่อไป
        </p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <TransactionsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function TransactionsContent({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard/transactions">["searchParams"];
}) {
  const user = await requireUser();
  const raw = await searchParams;
  const filters = filtersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, firstValue(value)])),
  );
  const query: TransactionFilters = {
    q: filters.q || undefined,
    month: filters.month,
    categoryId: filters.category,
    bankAccountId: filters.account,
  };

  const [result, categories, accounts, months] = await Promise.all([
    listTransactions(user.id, query, { page: filters.page ?? 1, pageSize: PAGE_SIZE }),
    listCategoriesForUser(user.id),
    listBankAccounts(user.id),
    listActiveMonths(user.id),
  ]);

  const optionsFor = (direction: "in" | "out") =>
    categories
      .filter((c) => c.kind === (direction === "in" ? "income" : "expense"))
      .map((c) => ({ id: c.id, name: c.name }));
  const options = { in: optionsFor("in"), out: optionsFor("out") };
  const isFiltered = Boolean(query.q || query.month || query.categoryId || query.bankAccountId);

  return (
    <>
      <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
        <FilterField label="ค้นหา" htmlFor="q">
          <Input id="q" name="q" type="search" defaultValue={filters.q} placeholder="เช่น ร้านกาแฟ, GRAB" />
        </FilterField>
        <FilterField label="เดือน" htmlFor="month">
          <select id="month" name="month" defaultValue={filters.month ?? ""} className={selectClassName}>
            <option value="">ทุกเดือน</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="หมวดหมู่" htmlFor="category">
          <select id="category" name="category" defaultValue={filters.category ?? ""} className={selectClassName}>
            <option value="">ทุกหมวด</option>
            <option value="none">ยังไม่จัดหมวด</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="บัญชี" htmlFor="account">
          <select id="account" name="account" defaultValue={filters.account ?? ""} className={selectClassName}>
            <option value="">ทุกบัญชี</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.nickname}
              </option>
            ))}
          </select>
        </FilterField>
        <div className="flex gap-2">
          <Button type="submit">กรอง</Button>
          {isFiltered && (
            <Link href="/dashboard/transactions" className={buttonVariants({ variant: "ghost" })}>
              ล้าง
            </Link>
          )}
        </div>
      </form>

      {result.total === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {isFiltered ? (
            "ไม่พบรายการที่ตรงกับตัวกรอง"
          ) : (
            <>
              ยังไม่มีรายการ —{" "}
              <Link href="/dashboard/import" className="text-foreground underline-offset-4 hover:underline">
                นำเข้า statement
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">พบ {result.total} รายการ</p>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap align-top">
                      {formatDate(row.occurredAt)}
                      <span className="block text-xs text-muted-foreground">{row.bankNickname}</span>
                    </TableCell>
                    <TableCell className="min-w-56 whitespace-normal align-top">{row.description}</TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap text-right align-top tabular-nums",
                        row.direction === "in" && "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {row.direction === "in" ? "+" : "−"}
                      {formatSatang(parseAmountToSatang(row.amount))}
                    </TableCell>
                    <TableCell className="align-top">
                      <CategoryCell
                        transactionId={row.id}
                        categoryId={row.categoryId}
                        categorySource={row.categorySource}
                        options={options[row.direction]}
                        suggestedPattern={row.merchant ?? row.description}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination filters={filters} page={result.page} pageCount={result.pageCount} />
        </>
      )}
    </>
  );
}

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function Pagination({ filters, page, pageCount }: { filters: Filters; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (key !== "page" && value) params.set(key, String(value));
    }
    if (target > 1) params.set("page", String(target));
    const search = params.toString();
    return `/dashboard/transactions${search ? `?${search}` : ""}`;
  };

  return (
    <nav aria-label="แบ่งหน้า" className="flex items-center justify-between gap-3 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
          ← ก่อนหน้า
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">
        หน้า {page} จาก {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
          ถัดไป →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
