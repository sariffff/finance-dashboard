import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCategoriesForUser } from "@/db/queries/categories";
import { listRecentTransactions } from "@/db/queries/transactions";
import { requireUser } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { formatSatang, parseAmountToSatang } from "@/lib/money";
import { cn } from "@/lib/utils";

import { CategoryCell } from "./category-cell";

export const metadata: Metadata = { title: "รายการธุรกรรม — Finance Dashboard" };

export default function TransactionsPage() {
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
        <TransactionsTable />
      </Suspense>
    </main>
  );
}

async function TransactionsTable() {
  const user = await requireUser();
  const [rows, categories] = await Promise.all([
    listRecentTransactions(user.id),
    listCategoriesForUser(user.id),
  ]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center text-muted-foreground">
        ยังไม่มีรายการ —{" "}
        <Link href="/dashboard/import" className="text-foreground underline-offset-4 hover:underline">
          นำเข้า statement
        </Link>
      </div>
    );
  }

  const optionsFor = (direction: "in" | "out") =>
    categories
      .filter((c) => c.kind === (direction === "in" ? "income" : "expense"))
      .map((c) => ({ id: c.id, name: c.name }));
  const options = { in: optionsFor("in"), out: optionsFor("out") };

  return (
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
          {rows.map((row) => (
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
  );
}
