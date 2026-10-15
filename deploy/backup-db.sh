#!/bin/sh
# สำรองฐานข้อมูลด้วย pg_dump เก็บใน ./backups แล้วลบไฟล์ที่เก่ากว่า KEEP_DAYS วัน
#
#   ./deploy/backup-db.sh              # รันเอง
#   crontab -e  แล้วเพิ่มบรรทัด:       # รันอัตโนมัติทุกวันตี 3
#   0 3 * * * cd /opt/finance-dashboard && ./deploy/backup-db.sh >> backups/backup.log 2>&1
#
# ไฟล์ backup มีข้อมูลการเงินของผู้ใช้ทั้งหมด — เก็บในเครื่องแบบ chmod 600
# และถ้าคัดลอกออกนอกเซิร์ฟเวอร์ให้เข้ารหัสก่อน
set -eu

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

umask 077
mkdir -p "$BACKUP_DIR"

file="$BACKUP_DIR/finance-$(date +%Y%m%d-%H%M%S).dump"

# exec -T: รันคำสั่งใน container db ที่เปิดอยู่ โดยไม่ต้องเปิดพอร์ต database ออกมา
# ใส่ '...' เพื่อให้ $POSTGRES_USER ถูกอ่านจากใน container ไม่ใช่จากเครื่องเรา
# --format=custom: ไฟล์บีบอัดแล้ว และใช้ pg_restore เลือกกู้บางตารางได้
# เขียนลงไฟล์ชั่วคราวก่อน — ถ้า pg_dump พังกลางทาง จะไม่ได้ไฟล์ backup ที่ไม่ครบ
$COMPOSE exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$file.partial"
mv "$file.partial" "$file"

echo "$(date '+%Y-%m-%d %H:%M:%S') backup saved: $file ($(du -h "$file" | cut -f1))"

find "$BACKUP_DIR" -name 'finance-*.dump' -type f -mtime +"$KEEP_DAYS" -print -delete
