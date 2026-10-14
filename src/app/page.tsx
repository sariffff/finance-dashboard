import Link from "next/link";

import { DemoSignInButton } from "@/components/demo-sign-in-button";
import { buttonVariants } from "@/components/ui/button";

const features = [
  {
    title: "นำเข้า statement",
    description: "อัปโหลดไฟล์ CSV / PDF จากธนาคารไทย หรือรูปสลิปโอนเงิน",
  },
  {
    title: "จัดหมวดหมู่อัตโนมัติ",
    description: "ใช้กฎที่ตั้งไว้ก่อน แล้วค่อยให้ AI ช่วยกับรายการที่เหลือ",
  },
  {
    title: "สรุปเป็นภาพ",
    description: "ดูรายรับ รายจ่าย และแนวโน้มรายเดือนได้ในหน้าเดียว",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 px-4 py-16">
      <section className="grid gap-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          รู้ว่าเงินไปไหน
          <br />
          จาก statement ธนาคารของคุณ
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Finance Dashboard แปลง statement เป็นรายการธุรกรรม
          จัดหมวดหมู่ให้อัตโนมัติ และสรุปรายจ่ายให้เข้าใจง่าย
        </p>
        <div className="flex flex-wrap items-start gap-3">
          <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
            เริ่มใช้งานฟรี
          </Link>
          <DemoSignInButton />
          <Link
            href="/sign-in"
            className={buttonVariants({ size: "lg", variant: "ghost" })}
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className="rounded-xl border p-5">
            <h2 className="font-medium">{feature.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
