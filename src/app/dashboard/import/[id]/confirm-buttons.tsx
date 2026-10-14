"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { cancelImportAction, confirmImportAction, type FormState } from "../actions";

export function ConfirmImportButtons({
  importId,
  newCount,
}: {
  importId: string;
  newCount: number;
}) {
  const [state, confirm, confirming] = useActionState<FormState>(
    () => confirmImportAction(importId),
    {},
  );

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-3">
        <form action={confirm}>
          <Button type="submit" size="lg" disabled={confirming || newCount === 0}>
            {confirming ? "กำลังบันทึกและจัดหมวด…" : `บันทึก ${newCount} รายการ`}
          </Button>
        </form>
        <form action={cancelImportAction.bind(null, importId)}>
          <Button type="submit" size="lg" variant="ghost" disabled={confirming}>
            ยกเลิก
          </Button>
        </form>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
