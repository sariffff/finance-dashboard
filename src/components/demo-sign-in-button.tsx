"use client";

import { useActionState } from "react";

import { signInDemoAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function DemoSignInButton({
  size = "lg",
}: {
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const [state, formAction, pending] = useActionState(signInDemoAction, {});

  return (
    <form action={formAction} className="grid gap-2">
      <Button type="submit" variant="outline" size={size} disabled={pending}>
        {pending ? "กำลังเข้าสู่ระบบ…" : "ลองใช้ด้วยบัญชีตัวอย่าง"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
