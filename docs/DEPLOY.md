# Deploy บน VPS

ทั้งระบบรันด้วย `docker-compose.prod.yml`: **db** (PostgreSQL) → **migrate** (รัน migration แล้วจบ) → **app** (Next.js) → **caddy** (HTTPS)
ไฟล์ต้นฉบับ (statement/สลิป) เก็บใน **Cloudflare R2** ไม่ได้อยู่บนเซิร์ฟเวอร์

```
อินเทอร์เน็ต ──443──▶ caddy ──▶ app:3000 ──▶ db:5432
                                  └────────▶ Cloudflare R2 (private)
```

มีแค่ caddy ที่เปิดพอร์ตออกนอกเครื่อง — db และ app คุยกันใน network ภายในของ Docker

## สิ่งที่ต้องมี
- VPS Linux (Ubuntu 24.04, RAM ≥ 2GB — `next build` ใช้หน่วยความจำเยอะ) พร้อม Docker + Docker Compose
- โดเมน ที่ตั้ง DNS **A record** ชี้มาที่ IP ของ VPS แล้ว
- เปิด firewall พอร์ต 22, 80, 443
- (ไม่บังคับ) Cloudflare R2 bucket แบบ private + API token, `ANTHROPIC_API_KEY`

## Deploy ครั้งแรก
```bash
git clone https://github.com/sariffff/finance-dashboard.git /opt/finance-dashboard
cd /opt/finance-dashboard
cp .env.production.example .env.production
nano .env.production          # ใส่ DOMAIN, รหัสผ่าน, secret (ดูวิธีสร้างในไฟล์)
chmod 600 .env.production

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# ใส่หมวดหมู่ตั้งต้น + บัญชี demo (รันซ้ำได้ ไม่สร้างซ้ำ)
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npm run db:seed
```
เปิด `https://<DOMAIN>` — ครั้งแรก Caddy ใช้เวลาไม่กี่วินาทีขอใบรับรอง HTTPS

> พิมพ์ยาวทุกครั้งเหนื่อย ตั้ง alias ได้: `alias dc='docker compose -f docker-compose.prod.yml --env-file .env.production'`

## อัปเดตเวอร์ชันใหม่
```bash
cd /opt/finance-dashboard
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
`migrate` รันใหม่ทุกครั้ง ถ้า migration ล้ม `app` ตัวใหม่จะไม่เปิด (ดู log: `... logs migrate`)

## คำสั่งที่ใช้บ่อย
| ทำอะไร | คำสั่ง (ต่อท้าย `docker compose -f docker-compose.prod.yml --env-file .env.production`) |
|---|---|
| ดูสถานะ | `ps` |
| ดู log แอป | `logs -f app` |
| เช็คสุขภาพ | `curl https://<DOMAIN>/api/health` |
| หยุดทั้งหมด (ข้อมูลยังอยู่) | `down` |

⚠️ ห้ามใช้ `down -v` — `-v` ลบ volume = ลบ database และใบรับรอง HTTPS ทิ้ง

## Backup
```bash
./scripts/backup-db.sh                 # ได้ไฟล์ backups/finance-<เวลา>.dump เก็บไว้ 14 ไฟล์ล่าสุด
crontab -e                             # ให้รันทุกคืนตี 3:
# 0 3 * * * cd /opt/finance-dashboard && ./scripts/backup-db.sh >> backups/backup.log 2>&1
```
กู้คืน (แทนที่ข้อมูลปัจจุบันทั้งหมด):
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  pg_restore --clean --if-exists -U finance -d finance < backups/<ไฟล์>.dump
```
ไฟล์ backup มีข้อมูลการเงินของผู้ใช้ — copy ออกไปเก็บนอกเซิร์ฟเวอร์ในที่ที่เป็น private

## ทดสอบในเครื่องก่อน deploy
ตั้ง `DOMAIN=localhost` ใน `.env.production` แล้วรันคำสั่งเดียวกัน → เปิด `https://localhost`
(Caddy ใช้ใบรับรองของตัวเอง เบราว์เซอร์จะเตือนว่าไม่ปลอดภัย — กดข้ามได้ เฉพาะตอนทดสอบ)
