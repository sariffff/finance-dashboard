"use client";

import { startTransition, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  createBankAccountAction,
  uploadStatementAction,
  type FormState,
} from "./actions";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

type BankOption = { code: string; name: string };
type AccountOption = { id: string; label: string };

export function BankAccountForm({ banks }: { banks: BankOption[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createBankAccountAction,
    {},
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
      <Field label="ธนาคาร" htmlFor="bankCode" errors={state.fieldErrors?.bankCode}>
        <select id="bankCode" name="bankCode" className={selectClassName} defaultValue={banks[0]?.code}>
          {banks.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="ชื่อบัญชี" htmlFor="nickname" errors={state.fieldErrors?.nickname}>
        <Input id="nickname" name="nickname" placeholder="เช่น บัญชีเงินเดือน" required />
      </Field>
      <Button type="submit" disabled={pending} className="sm:mt-6">
        {pending ? "กำลังบันทึก…" : "เพิ่มบัญชี"}
      </Button>
    </form>
  );
}

export function UploadStatementForm({ accounts }: { accounts: AccountOption[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    uploadStatementAction,
    {},
  );

  // Submit through onSubmit instead of `action` so React doesn't reset the
  // form afterwards: on a wrong password the user keeps the chosen file.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <Field label="บัญชีธนาคาร" htmlFor="bankAccountId" errors={state.fieldErrors?.bankAccountId}>
        <select id="bankAccountId" name="bankAccountId" className={selectClassName}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="ไฟล์ statement (PDF)"
        htmlFor="file"
        errors={state.fieldErrors?.file}
        hint="e-Statement ที่ได้รับทางอีเมลจากแอป SCB EASY ขนาดไม่เกิน 5MB"
      >
        <Input id="file" name="file" type="file" accept="application/pdf,.pdf" required />
      </Field>

      <Field
        label="รหัสผ่าน PDF"
        htmlFor="password"
        errors={state.fieldErrors?.password}
        hint="ใช้เปิดไฟล์ครั้งเดียว ระบบไม่บันทึกรหัสผ่านนี้"
      >
        <Input id="password" name="password" type="password" autoComplete="off" />
      </Field>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "กำลังอ่านไฟล์…" : "อ่านไฟล์และดูตัวอย่าง"}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  errors,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  errors?: string[];
  hint?: string;
  children: React.ReactElement<{ "aria-invalid"?: boolean }>;
}) {
  const hasError = Boolean(errors?.length);
  return (
    <div className={cn("grid gap-2", hasError && "[&_input]:border-destructive [&_select]:border-destructive")}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hasError ? (
        <p role="alert" className="text-sm text-destructive">
          {errors![0]}
        </p>
      ) : (
        hint && <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
