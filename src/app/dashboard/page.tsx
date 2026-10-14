import type { Metadata } from "next";
import { Suspense } from "react";

import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { listBankAccounts } from "@/db/queries/bank-accounts";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Dashboard — Finance Dashboard" };

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      {/* The session is request data, so it streams in behind Suspense
          while the static shell renders immediately. */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}

async function DashboardContent() {
  const user = await requireUser();
  const accounts = await listBankAccounts(user.id);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">สวัสดี, {user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline">
            ออกจากระบบ
          </Button>
        </form>
      </header>

      <section className="rounded-xl border p-6">
        <h2 className="font-medium">บัญชีธนาคาร</h2>
        {accounts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            ยังไม่มีบัญชีธนาคาร — การนำเข้า statement จะเปิดใช้ใน Phase 3
          </p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {accounts.map((account) => (
              <li key={account.id}>
                {account.nickname}{" "}
                <span className="text-muted-foreground">
                  ({account.bankCode.toUpperCase()})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="กำลังโหลด">
      <div className="h-14 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
