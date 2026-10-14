import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBankAccount } from "@/db/queries/bank-accounts";
import {
  countUncategorizedInImport,
  findExistingDedupeHashes,
  getImport,
} from "@/db/queries/imports";
import { requireUser } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { computeDedupeHashes } from "@/lib/import/dedupe";
import { formatSatang } from "@/lib/money";
import { cn } from "@/lib/utils";

import { recategorizeImportAction } from "../actions";
import { ConfirmImportButtons } from "./confirm-buttons";

export const metadata: Metadata = { title: "ตรวจรายการ — Finance Dashboard" };

export default function ImportPreviewPage({ params }: PageProps<"/dashboard/import/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/dashboard/import" className="text-sm text-muted-foreground hover:underline">
        ← กลับไปหน้านำเข้า
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <ImportPreview params={params} />
      </Suspense>
    </main>
  );
}

async function ImportPreview({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const found = await getImport(user.id, id);
  if (!found) notFound();
  const account = await getBankAccount(user.id, found.bankAccountId);

  if (found.status !== "pending" || !found.preview) {
    const uncategorized = await countUncategorizedInImport(user.id, found.id);
    return (
      <section className="grid gap-4 rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">บันทึกเรียบร้อย</h1>
        <p className="text-muted-foreground">
          {found.fileName} → {account?.nickname}
        </p>
        <p>
          เพิ่ม <strong>{found.rowCount}</strong> รายการใหม่
          {found.duplicateCount > 0 && (
            <> · ข้าม {found.duplicateCount} รายการที่มีอยู่แล้ว</>
          )}
        </p>
        {found.rowCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              จัดหมวดอัตโนมัติแล้ว {found.rowCount - uncategorized} จาก {found.rowCount} รายการ
            </span>
            {uncategorized > 0 && (
              <form action={recategorizeImportAction.bind(null, found.id)}>
                <Button type="submit" variant="outline" size="sm">
                  ลองจัดหมวดที่เหลืออีกครั้ง
                </Button>
              </form>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/transactions" className={buttonVariants()}>
            ดูและแก้หมวดหมู่
          </Link>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            ไปที่ Dashboard
          </Link>
          <Link href="/dashboard/import" className={buttonVariants({ variant: "outline" })}>
            นำเข้าไฟล์อื่น
          </Link>
        </div>
      </section>
    );
  }

  const { transactions, warnings } = found.preview;
  const hashes = computeDedupeHashes(found.bankAccountId, transactions);
  const existing = await findExistingDedupeHashes(user.id, hashes);
  const rows = transactions.map((tx, index) => ({
    ...tx,
    duplicate: existing.has(hashes[index]),
  }));

  const fresh = rows.filter((row) => !row.duplicate);
  const totalIn = fresh
    .filter((row) => row.direction === "in")
    .reduce((sum, row) => sum + row.amountSatang, 0);
  const totalOut = fresh
    .filter((row) => row.direction === "out")
    .reduce((sum, row) => sum + row.amountSatang, 0);
  const range = `${formatDate(rows[0].occurredAt)} – ${formatDate(rows.at(-1)!.occurredAt)}`;

  return (
    <>
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">ตรวจรายการก่อนบันทึก</h1>
        <p className="text-sm text-muted-foreground">
          {found.fileName} → {account?.nickname} · {range}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="รายการใหม่" value={`${fresh.length}`} />
        <Stat label="ซ้ำ (จะข้าม)" value={`${rows.length - fresh.length}`} />
        <Stat label="เงินเข้า" value={formatSatang(totalIn)} className="text-emerald-600 dark:text-emerald-400" />
        <Stat label="เงินออก" value={formatSatang(totalOut)} />
      </dl>

      {warnings.length > 0 && (
        <div role="status" className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">พบข้อสังเกต {warnings.length} รายการ</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmImportButtons importId={found.id} newCount={fresh.length} />

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>วันที่</TableHead>
              <TableHead>รายละเอียด</TableHead>
              <TableHead className="text-right">จำนวนเงิน</TableHead>
              <TableHead className="text-right">คงเหลือ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index} className={cn(row.duplicate && "text-muted-foreground")}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(row.occurredAt)}
                  {row.occurredTime && (
                    <span className="block text-xs text-muted-foreground">{row.occurredTime}</span>
                  )}
                </TableCell>
                <TableCell className="min-w-56 whitespace-normal">
                  {row.description}
                  {row.duplicate && (
                    <Badge variant="outline" className="ml-2">
                      ซ้ำ
                    </Badge>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums whitespace-nowrap",
                    row.direction === "in" && !row.duplicate && "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {row.direction === "in" ? "+" : "−"}
                  {formatSatang(row.amountSatang)}
                </TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap text-muted-foreground">
                  {row.balanceSatang !== null ? formatSatang(row.balanceSatang) : "–"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-lg font-semibold tabular-nums", className)}>{value}</dd>
    </div>
  );
}
