# Finance Dashboard — Project Context

@AGENTS.md

Personal Finance Dashboard: ผู้ใช้อัปโหลด statement ธนาคารไทย (CSV/PDF) หรือรูปสลิปโอนเงิน
ระบบแปลงเป็นรายการธุรกรรม จัดหมวดหมู่อัตโนมัติ (rules + AI) และแสดง dashboard สรุปรายจ่าย

เป้าหมายหลักของโปรเจกต์: **เป็น portfolio project** ให้ HR / tech lead ดู
→ คุณภาพโค้ด, README, และการ deploy ให้ใช้งานได้จริง สำคัญพอ ๆ กับฟีเจอร์

แผนงานทั้งหมดอยู่ที่ `docs/PLAN.md` — อ่านก่อนเริ่มงานทุกครั้ง และอัปเดต checkbox เมื่อทำเสร็จ

## Tech Stack (ตัดสินใจแล้ว ห้ามเปลี่ยนโดยไม่ถาม)
- Next.js (App Router) + TypeScript (strict) + Tailwind CSS + shadcn/ui
- PostgreSQL 17 รันใน Docker (`docker-compose.yml`) — **ไม่ใช้ Supabase**
- Drizzle ORM + drizzle-kit (migrations) + driver `postgres` (postgres.js)
- Better Auth (email/password) ใช้ Drizzle adapter
- Zod สำหรับ validate input ทุกจุดที่รับข้อมูลจากผู้ใช้หรือ AI
- Charts: shadcn/ui charts (Recharts)
- Testing: Vitest (unit), Playwright (e2e — ทำทีหลัง)
- Package manager: npm

## Commands
```bash
docker compose up -d          # เปิด PostgreSQL + Adminer (http://localhost:8080, server = db)
docker compose ps             # เช็คสถานะ container
npm run dev                   # Next.js dev server
npm run db:generate           # สร้าง migration จาก schema
npm run db:migrate            # รัน migration
npm run db:seed               # ใส่ข้อมูลตัวอย่าง + demo account
npm run test                  # Vitest
npm run lint && npm run typecheck
```
PostgreSQL ใน Docker เปิดที่ **localhost:5433** (เครื่องนี้มี PostgreSQL ของ Windows ใช้ 5432 อยู่แล้ว)

## กฎสำคัญ
- **เงิน**: เก็บเป็น `numeric(14,2)` ห้ามใช้ float — ใน TypeScript จัดการเป็น string หรือหน่วยสตางค์ (integer)
- **วันที่**: เก็บเป็น `date` / `timestamptz` สรุปยอดรายเดือนตาม timezone `Asia/Bangkok`
- **Authorization**: ทุก query ต้อง filter ด้วย `userId` ของ session ปัจจุบัน
  ไม่มี RLS ช่วยแล้ว → ใช้ helper กลาง และต้องมี test ว่าผู้ใช้ A อ่านข้อมูลผู้ใช้ B ไม่ได้
- **Secrets**: อยู่ใน `.env` เท่านั้น ห้าม commit, ห้าม hardcode, อัปเดต `.env.example` เมื่อเพิ่มตัวแปรใหม่
- **ไฟล์ statement / สลิปต้นฉบับ**: เก็บใน Cloudflare R2 แบบ private (ข้อมูลการเงินอ่อนไหว)
  bucket ห้าม public, เข้าถึงผ่าน signed URL อายุสั้นหลังเช็คเจ้าของไฟล์เท่านั้น, ผู้ใช้ลบไฟล์ของตัวเองได้
  **ห้ามเก็บรหัสผ่าน PDF**
- **AI output**: ต้องผ่าน Zod schema ก่อนใช้งานเสมอ ห้ามเชื่อ output ดิบ
- UI แสดงผลภาษาไทยเป็นหลัก, โค้ด/ชื่อตัวแปร/commit message เป็นภาษาอังกฤษ

## วิธีทำงานกับผู้ใช้
- ผู้ใช้**เพิ่งเริ่มเรียน Docker** — เวลาแก้ `docker-compose.yml`, เขียน `Dockerfile` หรือใช้คำสั่ง docker
  ให้อธิบายสั้น ๆ ว่าทำอะไรและทำไม (ภาษาไทย) อย่าทำเงียบ ๆ
- ทำทีละ Phase ตาม `docs/PLAN.md` จบ Phase แล้วสรุปสิ่งที่ทำ + วิธีทดสอบ แล้วรอผู้ใช้ยืนยันก่อนขึ้น Phase ถัดไป
- ถามก่อนติดตั้ง dependency ใหญ่ที่ไม่ได้อยู่ใน Tech Stack ข้างบน
- ห้ามรัน `docker compose down -v` (ลบข้อมูล database) โดยไม่ถาม
- Commit เล็ก ๆ ตาม Conventional Commits (`feat:`, `fix:`, `chore:` ...)
