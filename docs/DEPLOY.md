# Deploy บน VPS (Docker Compose + Caddy)

ภาพรวม: เซิร์ฟเวอร์ 1 เครื่อง รัน 4 container ด้วย `docker-compose.prod.yml`

```
อินเทอร์เน็ต ──443/80──▶ caddy ──▶ app (Next.js :3000) ──▶ db (PostgreSQL)
                         HTTPS อัตโนมัติ          │
                                                  └──▶ Cloudflare R2 (ไฟล์ต้นฉบับ, ไม่บังคับ)
migrate: รัน migration + seed ทุกครั้งที่ deploy แล้วจบ (แอปเปิดหลัง migrate สำเร็จเท่านั้น)
```

มีแค่ Caddy ที่เปิดพอร์ตออกนอกเครื่อง database เข้าจากอินเทอร์เน็ตไม่ได้

## 1. เตรียมเซิร์ฟเวอร์

- VPS Ubuntu 24.04, RAM อย่างน้อย 2 GB (ตอน `docker build` ใช้ RAM มาก ถ้ามี 1 GB ให้เพิ่ม swap)
- โดเมน: ตั้ง DNS **A record** ชี้ไปที่ IP ของ VPS (ต้องทำก่อนเปิด Caddy ไม่งั้นขอใบรับรอง HTTPS ไม่ผ่าน)

```bash
# ติดตั้ง Docker (สคริปต์ทางการของ Docker)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # ใช้ docker ได้โดยไม่ต้อง sudo (logout/login ใหม่หนึ่งครั้ง)

# Firewall: เปิดแค่ SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443
sudo ufw enable
```

> หมายเหตุ: พอร์ตที่ Docker เปิด (`ports:`) จะข้าม ufw ได้ — เราจึงเปิดแค่ 80/443 ของ Caddy
> และไม่ใส่ `ports:` ให้ database เลย

## 2. ติดตั้งแอป

```bash
sudo mkdir -p /opt/finance-dashboard && sudo chown $USER /opt/finance-dashboard
git clone https://github.com/sariffff/finance-dashboard.git /opt/finance-dashboard
cd /opt/finance-dashboard

cp deploy/env.production.example .env
chmod 600 .env                     # มีความลับ ให้เจ้าของอ่านได้คนเดียว
openssl rand -hex 32               # รันสองครั้ง: ใช้เป็น POSTGRES_PASSWORD และ BETTER_AUTH_SECRET
nano .env                          # ใส่ DOMAIN, รหัสผ่าน, (ไม่บังคับ) ANTHROPIC_API_KEY, R2

docker compose -f docker-compose.prod.yml up -d --build
```

`up -d --build` ทำอะไร:
1. build image ของแอป (ขั้น `runner`) และ image สำหรับ migration (ขั้น `migrator`) จาก `Dockerfile`
2. เปิด `db` แล้วรอจน healthy
3. รัน `migrate` (migration + seed หมวดหมู่ / กฎ / บัญชี demo) — ถ้าพัง แอปจะไม่เปิด
4. เปิด `app` และ `caddy` — Caddy ขอใบรับรอง HTTPS จาก Let's Encrypt เอง

ตรวจสอบ:

```bash
docker compose -f docker-compose.prod.yml ps        # app ต้องเป็น (healthy), migrate = Exited (0)
curl https://<โดเมน>/api/health                      # {"status":"ok"}
```

## 3. อัปเดตเวอร์ชันใหม่

```bash
cd /opt/finance-dashboard
./deploy/backup-db.sh                                # สำรองก่อนทุกครั้ง
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f                                # ลบ image เก่าที่ไม่ใช้แล้ว
```

migration ใหม่จะถูกรันอัตโนมัติผ่าน service `migrate`

## 4. Backup / Restore

```bash
./deploy/backup-db.sh                                       # ได้ไฟล์ backups/finance-<วันเวลา>.dump
./deploy/restore-db.sh backups/finance-20261015-030000.dump # ⚠️ เขียนทับข้อมูลปัจจุบัน (ถามยืนยันก่อน)
```

ตั้งให้ backup ทุกวันตี 3 และเก็บไว้ 14 วัน (`crontab -e`):

```
0 3 * * * cd /opt/finance-dashboard && ./deploy/backup-db.sh >> backups/backup.log 2>&1
```

ไฟล์ backup มีข้อมูลการเงินทั้งหมด: อยู่ในเซิร์ฟเวอร์แบบ `chmod 600` — ถ้าคัดลอกไปที่อื่น
(ซึ่งควรทำ เผื่อเซิร์ฟเวอร์เสีย) ให้เข้ารหัสก่อน เช่น `gpg -c <ไฟล์>`

## 5. ที่เก็บไฟล์ต้นฉบับ (Cloudflare R2)

ไม่บังคับ — ถ้าเว้น `S3_*` ว่าง แอปทำงานได้ปกติแต่ไม่เก็บไฟล์ statement/สลิปต้นฉบับ

1. Cloudflare dashboard → R2 → สร้าง bucket (**ห้ามเปิด public access**)
2. R2 → Manage API tokens → สร้าง token สิทธิ์ *Object Read & Write* เฉพาะ bucket นี้
3. ใส่ใน `.env`:
   ```
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=<ชื่อ bucket>
   S3_ACCESS_KEY_ID=<จาก token>
   S3_SECRET_ACCESS_KEY=<จาก token>
   S3_FORCE_PATH_STYLE=false
   ```
4. `docker compose -f docker-compose.prod.yml up -d` (ไม่ต้อง build ใหม่ — ค่า env อ่านตอนเปิด container)

ทำไมไม่ใช้ RustFS บนเซิร์ฟเวอร์เดียวกัน: ลิงก์ดาวน์โหลดไฟล์เป็น signed URL ที่เบราว์เซอร์เปิดตรงไปที่
ที่เก็บไฟล์ ที่เก็บไฟล์จึงต้องมี URL สาธารณะ (R2 มีให้อยู่แล้ว)

## คำสั่งที่ใช้บ่อย

```bash
docker compose -f docker-compose.prod.yml logs -f app        # ดู log แอปแบบสด (Ctrl+C ออก)
docker compose -f docker-compose.prod.yml logs migrate       # migration ครั้งล่าสุดผ่านไหม
docker compose -f docker-compose.prod.yml restart app        # เปิดแอปใหม่
docker compose -f docker-compose.prod.yml exec db psql -U finance -d finance   # เข้า database
```

> ห้ามใช้ `docker compose -f docker-compose.prod.yml down -v` — `-v` ลบ volume = ลบ database
> และใบรับรอง HTTPS ทั้งหมด (`down` เฉย ๆ ไม่ลบข้อมูล)

## ทดสอบทั้งระบบในเครื่องก่อน deploy

`.env` ตอนพัฒนาใช้ไม่ได้ (เช่น `S3_ENDPOINT=http://localhost:9000` — ใน container
`localhost` คือตัว container เอง ไม่ใช่เครื่องเรา) จึงทดสอบจากโฟลเดอร์แยก:

```bash
git clone . ../finance-prod-test && cd ../finance-prod-test
cp deploy/env.production.example .env    # ใส่ DOMAIN=localhost + รหัสผ่าน, เว้น S3_* ว่าง
docker compose -f docker-compose.prod.yml up -d --build
```

เปิด https://localhost — Caddy ใช้ใบรับรองที่สร้างเอง เบราว์เซอร์จะเตือน ให้กดยอมรับ
ชื่อโปรเจกต์ `finance-prod` แยกจาก stack ตอนพัฒนา จึงรันพร้อมกันได้โดยไม่ยุ่งกับ database ตอนพัฒนา
เสร็จแล้วปิดด้วย `docker compose -f docker-compose.prod.yml down -v` (ตรงนี้ใช้ `-v` ได้ เพราะเป็นข้อมูลทดสอบ)
