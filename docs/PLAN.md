# Finance Dashboard — Implementation Plan

> วางไฟล์นี้ไว้ที่ `docs/PLAN.md` ทำทีละ Phase ติ๊ก `[x]` เมื่อเสร็จ
> แต่ละ Phase มี "Done when" — ต้องผ่านทุกข้อก่อนไป Phase ถัดไป

## Decisions (ผู้ใช้ตอบแล้ว 2026-10-14)
- ธนาคารแรก: **SCB** — ผู้ใช้ไม่มีไฟล์ตัวอย่าง → หาข้อมูล format จริงของ SCB จากแหล่งสาธารณะ แล้วสร้าง fixture ข้อมูลปลอมเอง
- AI provider: **Claude (Anthropic)**
- ไฟล์ต้นฉบับ (statement + สลิป): **เก็บใน Cloudflare R2** (private)

---

## Phase 0 — Setup ✅
- [x] สร้างโปรเจกต์ Next.js (TypeScript, Tailwind, App Router)
- [x] `docker-compose.yml`: PostgreSQL 17 + Adminer, ข้อมูลเก็บใน volume `pgdata`
- [x] `.env` / `.env.example`, `.env` อยู่ใน `.gitignore`
- [x] รัน `docker compose up -d` และเข้า Adminer ได้

---

## Phase 1 — Database + Drizzle
- [ ] ติดตั้ง `drizzle-orm`, `postgres`, `drizzle-kit`, `zod`, `dotenv`
- [ ] `drizzle.config.ts` อ่าน `DATABASE_URL` จาก `.env`
- [ ] `src/db/index.ts` — สร้าง db client (singleton กัน connection บานตอน hot reload)
- [ ] `src/db/schema.ts` — ตารางตาม "Data Model" ด้านล่าง
- [ ] เพิ่ม scripts: `db:generate`, `db:migrate`, `db:studio`, `db:seed`, `typecheck`, `test`
- [ ] Seed: หมวดหมู่ตั้งต้น (default categories) ภาษาไทย
- [ ] ติดตั้ง Vitest + เขียน test แรก (เช่น helper แปลงจำนวนเงิน)

**Done when:** `npm run db:migrate` สร้างตารางครบ เห็นใน Adminer, `npm run db:seed` ใส่หมวดหมู่ได้, typecheck ผ่าน

### Data Model
| ตาราง | ฟิลด์หลัก | หมายเหตุ |
|---|---|---|
| user / session / account / verification | ตาม Better Auth | ให้ Better Auth generate schema |
| bank_accounts | id, userId, bankCode, nickname, createdAt | บัญชีธนาคารของผู้ใช้ |
| categories | id, userId (nullable), name, icon, color, kind (`income`/`expense`) | userId = null คือหมวดตั้งต้นของระบบ |
| transactions | id, userId, bankAccountId, importId, occurredAt (date), description, merchant, amount numeric(14,2), direction (`in`/`out`), categoryId, categorySource (`rule`/`ai`/`user`), dedupeHash, createdAt | unique (userId, dedupeHash) กันนำเข้าซ้ำ, index (userId, occurredAt) |
| category_rules | id, userId (nullable), pattern, matchType (`contains`/`regex`), categoryId, source (`system`/`user`/`ai_cache`), priority | ใช้จัดหมวดก่อนเรียก AI และเป็น cache ผล AI |
| imports | id, userId, bankAccountId, fileName, fileType (`csv`/`pdf`/`slip`), status, rowCount, duplicateCount, createdAt | ประวัติการนำเข้า |

---

## Phase 2 — Authentication
- [ ] ติดตั้ง Better Auth + Drizzle adapter, generate ตาราง auth แล้ว migrate
- [ ] หน้า `/sign-up`, `/sign-in`, ปุ่ม sign out
- [ ] Protect ทุกหน้าใต้ `/dashboard` (middleware หรือ server-side check)
- [ ] Helper `requireUser()` สำหรับ server actions / route handlers
- [ ] **Demo account**: ปุ่ม "ลองใช้ด้วยบัญชีตัวอย่าง" ล็อกอินเข้าบัญชีที่มีข้อมูล seed ไว้
- [ ] Test: ผู้ใช้ A query ข้อมูลของผู้ใช้ B ไม่ได้

**Done when:** สมัคร/ล็อกอิน/ออกได้, เข้า `/dashboard` โดยไม่ล็อกอินแล้วถูก redirect, test authorization ผ่าน

---

## Phase 3 — Import CSV (ธนาคารเดียวก่อน)
- [ ] ธนาคารแรก = SCB → ค้นหา format CSV ของ SCB แล้วสร้าง fixture ข้อมูลปลอม (ผู้ใช้ไม่มีไฟล์ตัวอย่าง)
- [ ] สร้าง/เลือก bank account
- [ ] หน้าอัปโหลด CSV → parse ฝั่ง server → **หน้า preview** ให้ผู้ใช้ตรวจก่อนบันทึก
- [ ] Parser แยกเป็น module ต่อธนาคาร: `src/lib/parsers/<bank>.ts` ใช้ interface เดียวกัน
      (`parse(file) => ParsedTransaction[]`) เพื่อเพิ่มธนาคารอื่นได้ง่าย
- [ ] คำนวณ `dedupeHash` (วันที่ + จำนวนเงิน + description + บัญชี) ข้ามรายการซ้ำและแจ้งจำนวน
- [ ] บันทึก record ใน `imports`
- [ ] Unit test parser ด้วย fixture CSV ตัวอย่าง (ข้อมูลปลอม)

**Done when:** อัปโหลด CSV → preview → บันทึกได้, อัปโหลดไฟล์เดิมซ้ำไม่เกิดรายการซ้ำ, test parser ผ่าน

---

## Phase 4 — จัดหมวดหมู่อัตโนมัติ (Rules → AI → Cache)
- [ ] ขั้น 1: จับคู่กับ `category_rules` (user rules ก่อน system rules ตาม priority)
- [ ] ขั้น 2: รายการที่ไม่ตรงกฎ → ส่งให้ AI เป็น batch (หลายรายการต่อหนึ่ง request)
- [ ] AI ต้องตอบเป็น JSON ตาม Zod schema (`{ id, categoryName, merchant }[]`) และเลือกได้เฉพาะหมวดที่มีอยู่
- [ ] บันทึกผล AI เป็น rule `source = ai_cache` ตามชื่อร้าน → ครั้งหน้าไม่ต้องเรียก AI ซ้ำ
- [ ] ผู้ใช้แก้หมวดเองได้ → ถามว่า "ใช้กับร้านนี้ทุกครั้งไหม" → สร้าง user rule
- [ ] ถ้า AI ล่มหรือ timeout → รายการเป็น "ยังไม่จัดหมวด" ระบบไม่พัง
- [x] AI provider = Claude (Anthropic) — `ANTHROPIC_API_KEY` อยู่ใน `.env`
- [ ] Test: logic การจับคู่กฎ และการ validate output ของ AI (mock AI)

**Done when:** นำเข้าแล้วรายการส่วนใหญ่มีหมวดอัตโนมัติ, นำเข้าร้านเดิมครั้งที่ 2 ไม่เรียก AI, แก้หมวดเองแล้วจำได้

---

## Phase 5 — Dashboard
- [ ] การ์ดสรุป: รายรับ / รายจ่าย / คงเหลือ ของเดือนที่เลือก
- [ ] กราฟสัดส่วนรายจ่ายตามหมวด
- [ ] กราฟแนวโน้มรายจ่าย 6–12 เดือน
- [ ] ตารางธุรกรรม: ค้นหา, filter ตามเดือน/หมวด/บัญชี, แบ่งหน้า
- [ ] Query สรุปยอดทำใน SQL (GROUP BY) ไม่ใช่ loop ใน JS
- [ ] Responsive ใช้บนมือถือได้, มี loading และ empty state

**Done when:** demo account เปิดมาเห็น dashboard สวยและข้อมูลถูกต้อง ทั้งจอคอมและมือถือ

---

## Phase 6 — AI Insights
- [ ] สรุปรายเดือนเป็นภาษาไทย เช่น "เดือนนี้ค่าอาหารเพิ่มขึ้น 25% จากเดือนก่อน"
- [ ] คำนวณตัวเลขใน SQL ก่อน แล้วส่งเฉพาะตัวเลขสรุปให้ AI เขียนข้อความ (ไม่ส่งรายการดิบ)
- [ ] Cache ผลสรุปต่อเดือน ไม่ generate ใหม่ทุกครั้งที่เปิดหน้า

---

## Phase 7 — PDF Statement + สลิปโอนเงิน
- [ ] รองรับ PDF statement ที่มีรหัสผ่าน (ผู้ใช้กรอกรหัส, ไม่เก็บรหัส)
- [ ] เพิ่ม parser ธนาคารที่ 2
- [ ] อัปโหลดรูปสลิป → AI อ่านข้อมูล (วันที่, จำนวนเงิน, ผู้รับ) → preview ก่อนบันทึก
- [ ] เก็บไฟล์ต้นฉบับ (statement + สลิป) ใน Cloudflare R2 แบบ private + signed URL + ผู้ใช้ลบได้
      (ถ้าต้องการให้ Phase 3 เก็บ CSV ด้วย ให้ย้ายงาน R2 ขึ้นมาทำก่อน)

---

## Phase 8 — Docker ทั้งระบบ + CI/CD + Deploy  🐳 (อธิบายทุกขั้น ผู้ใช้กำลังเรียน)
- [ ] `Dockerfile` แบบ multi-stage สำหรับ Next.js (`output: "standalone"`)
- [ ] `docker-compose.prod.yml`: app + db (+ reverse proxy เช่น Caddy สำหรับ HTTPS)
- [ ] รัน migration ตอน deploy
- [ ] GitHub Actions: lint, typecheck, test ทุก push/PR
- [ ] Deploy บน VPS + โดเมน + HTTPS
- [ ] สคริปต์ backup database (`pg_dump`)

**Done when:** เปิดเว็บผ่านโดเมนจริงได้, push แล้ว CI รันอัตโนมัติ

---

## Phase 9 — Portfolio Polish
- [ ] README: ปัญหาที่แก้, ฟีเจอร์, GIF สาธิต, ลิงก์ demo, tech stack + เหตุผลที่เลือก
- [ ] Architecture diagram
- [ ] หัวข้อ "Technical decisions" เช่น Rules→AI→Cache ลดค่า API, การเก็บเงินเป็น numeric, การจัดการข้อมูลอ่อนไหว
- [ ] ข้อมูล demo สมจริง 6–12 เดือน
- [ ] Playwright e2e สำหรับ flow หลัก (login → import → dashboard)
