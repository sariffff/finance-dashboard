"use client";

import { startTransition, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SlipDraft } from "@/lib/import/types";

import type { FormState } from "./actions";
import { confirmSlipAction, uploadSlipAction } from "./slip-actions";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function SlipUploadForm({
  accounts,
  aiEnabled,
}: {
  accounts: { id: string; label: string }[];
  aiEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(uploadSlipAction, {});

  // Submit without React's automatic form reset so the chosen file stays.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <Field label="บัญชีที่ใช้โอน / รับโอน" htmlFor="slip-account" error={state.fieldErrors?.bankAccountId?.[0]}>
        <select id="slip-account" name="bankAccountId" className={selectClassName}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="รูปสลิป"
        htmlFor="slip-file"
        error={state.fieldErrors?.file?.[0]}
        hint={
          aiEnabled
            ? "JPG, PNG หรือ WEBP ไม่เกิน 5MB — AI จะช่วยอ่านข้อมูลให้ แล้วคุณตรวจก่อนบันทึก"
            : "JPG, PNG หรือ WEBP ไม่เกิน 5MB — ยังไม่ได้ตั้งค่า AI จึงต้องกรอกข้อมูลเองจากรูป"
        }
      >
        <Input id="slip-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
      </Field>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? (aiEnabled ? "กำลังอ่านสลิป…" : "กำลังอัปโหลด…") : "อัปโหลดสลิป"}
      </Button>
    </form>
  );
}

export function SlipConfirmForm({ importId, draft }: { importId: string; draft: SlipDraft }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    confirmSlipAction.bind(null, importId),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const suggestedDescription = draft.toName
    ? `โอนไป ${draft.toName}`
    : draft.fromName
      ? `รับโอนจาก ${draft.fromName}`
      : "";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="วันที่" htmlFor="date" error={errors.date?.[0]}>
          <Input id="date" name="date" type="date" defaultValue={draft.date ?? ""} required />
        </Field>
        <Field label="เวลา" htmlFor="time" error={errors.time?.[0]}>
          <Input id="time" name="time" type="time" defaultValue={draft.time ?? ""} />
        </Field>
        <Field label="จำนวนเงิน (บาท)" htmlFor="amount" error={errors.amount?.[0]}>
          <Input id="amount" name="amount" inputMode="decimal" defaultValue={draft.amount ?? ""} placeholder="เช่น 1250.75" required />
        </Field>
        <Field label="ประเภท" htmlFor="direction" error={errors.direction?.[0]}>
          <select id="direction" name="direction" defaultValue="out" className={selectClassName}>
            <option value="out">เงินออก (โอนจ่าย)</option>
            <option value="in">เงินเข้า (รับโอน)</option>
          </select>
        </Field>
      </div>
      <Field label="รายละเอียด" htmlFor="description" error={errors.description?.[0]}>
        <Input id="description" name="description" defaultValue={suggestedDescription} required />
      </Field>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "บันทึกรายการ"}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
