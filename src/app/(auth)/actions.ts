"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/env";
import { auth } from "@/lib/auth";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password", string[]>>;
  values?: { name?: string; email?: string };
};

const signInSchema = z.object({
  email: z.email("อีเมลไม่ถูกต้อง").trim().toLowerCase(),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

const signUpSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100, "ชื่อยาวเกินไป"),
  email: z.email("อีเมลไม่ถูกต้อง").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    .max(128, "รหัสผ่านยาวเกินไป"),
});

const errorMessages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  USER_ALREADY_EXISTS: "อีเมลนี้ถูกใช้สมัครแล้ว",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "อีเมลนี้ถูกใช้สมัครแล้ว",
};

function toFormError(error: unknown): AuthFormState {
  if (error instanceof APIError) {
    const code = error.body?.code;
    return {
      error: (code && errorMessages[code]) ?? "เกิดข้อผิดพลาด กรุณาลองใหม่",
    };
  }
  throw error;
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    return { ...toFormError(error), values };
  }
  redirect("/dashboard");
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  try {
    // Signs the new user in as well (autoSignIn is on by default).
    await auth.api.signUpEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    return { ...toFormError(error), values };
  }
  redirect("/dashboard");
}

export async function signInDemoAction(): Promise<AuthFormState> {
  try {
    await auth.api.signInEmail({
      body: { email: env.DEMO_USER_EMAIL, password: env.DEMO_USER_PASSWORD },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { error: "บัญชีตัวอย่างยังไม่พร้อม (ลองรัน npm run db:seed)" };
    }
    throw error;
  }
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
