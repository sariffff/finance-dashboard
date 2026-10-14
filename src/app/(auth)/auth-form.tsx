"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { AuthFormState } from "./actions";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
};

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const isSignUp = mode === "sign-up";

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {isSignUp && (
        <Field
          label="ชื่อ"
          name="name"
          autoComplete="name"
          defaultValue={state.values?.name}
          errors={state.fieldErrors?.name}
        />
      )}
      <Field
        label="อีเมล"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <Field
        label="รหัสผ่าน"
        name="password"
        type="password"
        autoComplete={isSignUp ? "new-password" : "current-password"}
        errors={state.fieldErrors?.password}
        hint={isSignUp ? "อย่างน้อย 8 ตัวอักษร" : undefined}
      />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "กำลังดำเนินการ…" : isSignUp ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
      </Button>
    </form>
  );
}

type FieldProps = React.ComponentProps<"input"> & {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
};

function Field({ label, name, errors, hint, ...props }: FieldProps) {
  const errorId = `${name}-error`;
  const hasError = Boolean(errors?.length);

  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        required
        {...props}
      />
      {hasError ? (
        <p id={errorId} className="text-sm text-destructive">
          {errors![0]}
        </p>
      ) : (
        hint && <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
