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
- [x] `.env` / `.env.example`, `.env` อยู่ใน `.gitignore` (`!.env.example` ให้ commit template ได้)
- [x] รัน `docker compose up -d` และเข้า Adminer ได้

---

## Phase 1 — Database + Drizzle ✅
- [x] ติดตั้ง `drizzle-orm`, `postgres`, `drizzle-kit`, `zod`, `dotenv`
- [x] `drizzle.config.ts` อ่าน `DATABASE_URL` จาก `.env`
- [x] `src/db/index.ts` — สร้าง db client (singleton กัน connection บานตอน hot reload)
- [x] `src/db/schema.ts` — ตารางตาม "Data Model" ด้านล่าง
- [x] เพิ่ม scripts: `db:generate`, `db:migrate`, `db:studio`, `db:seed`, `typecheck`, `test`
- [x] Seed: หมวดหมู่ตั้งต้น (default categories) ภาษาไทย
- [x] ติดตั้ง Vitest + เขียน test แรก (เช่น helper แปลงจำนวนเงิน)

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

## Phase 2 — Authentication ✅
- [x] ติดตั้ง Better Auth + Drizzle adapter, generate ตาราง auth แล้ว migrate
- [x] หน้า `/sign-up`, `/sign-in`, ปุ่ม sign out
- [x] Protect ทุกหน้าใต้ `/dashboard` — `src/proxy.ts` (เช็ค cookie คร่าว ๆ) + `requireUser()` (เช็คจริง)
- [x] Helper `requireUser()` สำหรับ server actions / route handlers
- [x] **Demo account**: ปุ่ม "ลองใช้ด้วยบัญชีตัวอย่าง" ล็อกอินเข้าบัญชีที่มีข้อมูล seed ไว้
- [x] Test: ผู้ใช้ A query ข้อมูลของผู้ใช้ B ไม่ได้

**Done when:** สมัคร/ล็อกอิน/ออกได้, เข้า `/dashboard` โดยไม่ล็อกอินแล้วถูก redirect, test authorization ผ่าน

---

## Phase 3 — Import SCB PDF statement ✅
> เปลี่ยนจาก CSV → PDF (2026-10-14): บัญชีส่วนตัว SCB ดาวน์โหลดได้แค่ e-Statement PDF ที่มีรหัสผ่าน
> CSV มีเฉพาะบัญชีธุรกิจ (Business Anywhere) และไม่มี spec สาธารณะ
> **รูปแบบ PDF อ้างอิงจากข้อมูลสาธารณะ ยังไม่เคยทดสอบกับไฟล์จริง** → fixture เป็น PDF ปลอมที่จำลอง layout ขึ้นมา
- [x] อ่าน PDF ด้วย `unpdf` (รองรับรหัสผ่าน, ได้ตำแหน่ง x/y ของข้อความ) — ผู้ใช้กรอกรหัส, **ไม่เก็บรหัส ไม่ log**
- [x] สร้าง/เลือก bank account
- [x] หน้าอัปโหลด PDF → parse ฝั่ง server → **หน้า preview** (import สถานะ `pending`) ให้ผู้ใช้ตรวจก่อนบันทึก
- [x] Parser แยกเป็น module ต่อธนาคาร: `src/lib/parsers/<bank>.ts` ใช้ interface เดียวกัน เพื่อเพิ่มธนาคารอื่นได้ง่าย
- [x] SCB parser: แยกคอลัมน์จากตำแหน่ง header, ถอน/ฝากจากคอลัมน์ + ตรวจกับยอดคงเหลือ, รายละเอียดหลายบรรทัด, หลายหน้า
- [x] คำนวณ `dedupeHash` (บัญชี + วันที่ + เวลา + จำนวนเงิน + ทิศทาง + description + ลำดับที่ซ้ำในไฟล์) ข้ามรายการซ้ำและแจ้งจำนวน
- [x] บันทึก record ใน `imports`
- [x] Script สร้าง fixture PDF ปลอม (มีรหัสผ่าน, ภาษาไทย, 2 หน้า) + unit test parser
- [ ] (ยกไป Phase 7) เก็บไฟล์ต้นฉบับใน R2 — ต้องมี R2 credentials ก่อน

**Done when:** อัปโหลด PDF + รหัส → preview → บันทึกได้, อัปโหลดไฟล์เดิมซ้ำไม่เกิดรายการซ้ำ, รหัสผิดแจ้งเตือนชัดเจน, test parser ผ่าน

---

## Phase 4 — จัดหมวดหมู่อัตโนมัติ (Rules → AI → Cache) ✅
- [x] ขั้น 1: จับคู่กับ `category_rules` (user rules → ai_cache → system rules, แล้วตาม priority / ความยาว pattern)
- [x] ขั้น 2: รายการที่ไม่ตรงกฎ → ส่งให้ AI เป็น batch (50 รายการ/request, ถามครั้งเดียวต่อ description ที่ซ้ำกัน)
- [x] AI ต้องตอบเป็น JSON ตาม Zod schema (`{ id, categoryName, merchant }[]`) และเลือกได้เฉพาะหมวดที่มีอยู่
- [x] บันทึกผล AI เป็น rule `source = ai_cache` ตามชื่อร้าน → ครั้งหน้าไม่ต้องเรียก AI ซ้ำ
- [x] ผู้ใช้แก้หมวดเองได้ → ถามว่า "ใช้กับร้านนี้ทุกครั้งไหม" → สร้าง user rule (หน้า `/dashboard/transactions`)
- [x] ถ้า AI ล่มหรือ timeout → รายการเป็น "ยังไม่จัดหมวด" ระบบไม่พัง (มีปุ่มลองจัดหมวดอีกครั้ง)
- [x] AI provider = Claude (Anthropic) — `ANTHROPIC_API_KEY` อยู่ใน `.env` (ไม่ใส่ = ใช้กฎอย่างเดียว)
- [x] Test: logic การจับคู่กฎ และการ validate output ของ AI (mock AI)
- [x] System rules ตั้งต้นสำหรับร้านที่พบบ่อยในไทย (seed)
- [ ] ทดสอบกับ Claude API จริง (ต้องใส่ `ANTHROPIC_API_KEY` ใน `.env`) — ตอนนี้ทดสอบด้วย AI จำลองเท่านั้น

**Done when:** นำเข้าแล้วรายการส่วนใหญ่มีหมวดอัตโนมัติ, นำเข้าร้านเดิมครั้งที่ 2 ไม่เรียก AI, แก้หมวดเองแล้วจำได้

---

## Phase 5 — Dashboard ✅
- [x] การ์ดสรุป: รายรับ / รายจ่าย / คงเหลือ ของเดือนที่เลือก (+ เทียบรายจ่ายกับเดือนก่อน)
- [x] กราฟสัดส่วนรายจ่ายตามหมวด — แท่งแนวนอนเรียงมาก→น้อย (อ่านง่ายกว่า pie เมื่อมี >3 หมวด)
- [x] กราฟแนวโน้มรายรับ/รายจ่าย 6 เดือน (เดือนที่ไม่มีข้อมูล = 0) + ดูเป็นตาราง
- [x] ตารางธุรกรรม: ค้นหา, filter ตามเดือน/หมวด/บัญชี, แบ่งหน้า (filter อยู่ใน URL)
- [x] Query สรุปยอดทำใน SQL (GROUP BY, generate_series) ไม่ใช่ loop ใน JS
- [x] Responsive ใช้บนมือถือได้, มี loading และ empty state
- [x] สีกราฟใช้ palette ที่ผ่านการตรวจ CVD/contrast ทั้ง light และ dark

**Done when:** demo account เปิดมาเห็น dashboard สวยและข้อมูลถูกต้อง ทั้งจอคอมและมือถือ

---

## Phase 6 — AI Insights ✅
- [x] สรุปรายเดือนเป็นภาษาไทย เช่น "เดือนนี้ค่าอาหารเพิ่มขึ้น 25% จากเดือนก่อน"
- [x] คำนวณตัวเลขใน SQL ก่อน แล้วส่งเฉพาะตัวเลขสรุปให้ AI เขียนข้อความ (ไม่ส่งรายการดิบ)
- [x] Cache ผลสรุปต่อเดือน ไม่ generate ใหม่ทุกครั้งที่เปิดหน้า (`monthly_insights` + hash ของตัวเลข → สร้างใหม่เฉพาะเมื่อตัวเลขเปลี่ยน)
- [x] ตัดประโยคที่มีตัวเลขไม่ตรงกับข้อมูลจริงทิ้ง (กัน AI คำนวณผิด/แต่งตัวเลข)
- [x] ไม่มี API key หรือ AI ล่ม → ใช้สรุปจากกฎแทน
- [ ] ทดสอบกับ Claude API จริง (ต้องใส่ `ANTHROPIC_API_KEY`)

---

## Phase 7 — ธนาคารที่ 2 + สลิปโอนเงิน + R2
- [x] ~~รองรับ PDF statement ที่มีรหัสผ่าน~~ → ย้ายไป Phase 3
- [ ] เพิ่ม parser ธนาคารที่ 2
- [ ] อัปโหลดรูปสลิป → AI อ่านข้อมูล (วันที่, จำนวนเงิน, ผู้รับ) → preview ก่อนบันทึก
- [ ] เก็บไฟล์ต้นฉบับ (statement + สลิป) ใน Cloudflare R2 แบบ private + signed URL + ผู้ใช้ลบได้
      (`imports.storageKey` เตรียมไว้แล้ว — ต้องขอ R2 credentials จากผู้ใช้)
- [ ] ทดสอบ SCB parser กับ statement จริงของผู้ใช้ (fixture ตอนนี้จำลอง layout จากข้อมูลสาธารณะ)

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
