import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { signUpAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "สมัครสมาชิก — Finance Dashboard" };

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">สมัครสมาชิก</CardTitle>
        <CardDescription>เริ่มนำเข้า statement และติดตามรายจ่าย</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="sign-up" action={signUpAction} />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        มีบัญชีอยู่แล้ว?&nbsp;
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          เข้าสู่ระบบ
        </Link>
      </CardFooter>
    </Card>
  );
}
