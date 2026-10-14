import type { Metadata } from "next";
import Link from "next/link";

import { DemoSignInButton } from "@/components/demo-sign-in-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { signInAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ — Finance Dashboard" };

export default function SignInPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">เข้าสู่ระบบ</CardTitle>
        <CardDescription>ดูสรุปรายรับรายจ่ายของคุณ</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <AuthForm mode="sign-in" action={signInAction} />
        <Divider />
        <DemoSignInButton />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        ยังไม่มีบัญชี?&nbsp;
        <Link href="/sign-up" className="font-medium text-foreground underline-offset-4 hover:underline">
          สมัครสมาชิก
        </Link>
      </CardFooter>
    </Card>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      หรือ
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
