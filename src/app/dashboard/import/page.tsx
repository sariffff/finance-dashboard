import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listBankAccounts } from "@/db/queries/bank-accounts";
import { listRecentImports } from "@/db/queries/imports";
import { requireUser } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { getParser, parsers } from "@/lib/parsers";

import { BankAccountForm, UploadStatementForm } from "./forms";

export const metadata: Metadata = { title: "นำเข้า statement — Finance Dashboard" };

const banks = Object.values(parsers).map((parser) => ({
  code: parser.bankCode,
  name: parser.bankName,
}));

export default function ImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          ← กลับไปหน้า Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">นำเข้า statement</h1>
      </div>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <ImportContent />
      </Suspense>
    </main>
  );
}

async function ImportContent() {
  const user = await requireUser();
  const [accounts, recentImports] = await Promise.all([
    listBankAccounts(user.id),
    listRecentImports(user.id),
  ]);

  const accountOptions = accounts.map((account) => ({
    id: account.id,
    label: `${account.nickname} (${getParser(account.bankCode)?.bankName ?? account.bankCode})`,
  }));

  return (
    <>
      {accounts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>อัปโหลดไฟล์</CardTitle>
            <CardDescription>
              ระบบจะแสดงรายการให้ตรวจก่อน ยังไม่บันทึกจนกว่าคุณจะกดยืนยัน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadStatementForm accounts={accountOptions} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{accounts.length > 0 ? "เพิ่มบัญชีธนาคาร" : "เริ่มจากเพิ่มบัญชีธนาคาร"}</CardTitle>
          <CardDescription>
            รองรับ statement PDF ของ {banks.map((bank) => bank.name).join(", ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankAccountForm banks={banks} />
        </CardContent>
      </Card>

      {recentImports.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-medium">นำเข้าล่าสุด</h2>
          <ul className="divide-y rounded-xl border">
            {recentImports.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/dashboard/import/${item.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.fileName}</span>
                    <span className="text-muted-foreground">
                      {item.bankNickname} · {formatDateTime(item.createdAt)}
                    </span>
                  </span>
                  {item.status === "completed" ? (
                    <Badge variant="secondary">บันทึก {item.rowCount} รายการ</Badge>
                  ) : (
                    <Badge variant="outline">รอยืนยัน</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
