#!/usr/bin/env sh
# สำรอง database ของ production ด้วย pg_dump แล้วเก็บไว้ในโฟลเดอร์ backups/
#
#   ./scripts/backup-db.sh            # เก็บไว้ 14 ไฟล์ล่าสุด
#   KEEP=30 ./scripts/backup-db.sh    # เก็บไว้ 30 ไฟล์ล่าสุด
#
# ตั้งให้รันทุกคืนด้วย cron (crontab -e):
#   0 3 * * * cd /opt/finance-dashboard && ./scripts/backup-db.sh >> backups/backup.log 2>&1
#
# กู้คืน (ข้อมูลปัจจุบันถูกแทนที่ทั้งหมด):
#   docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
#     sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/<ไฟล์>.dump
#
# หมายเหตุ: ไฟล์ backup มีข้อมูลการเงินของผู้ใช้ — ควร copy ออกไปเก็บนอกเซิร์ฟเวอร์
# (เช่น R2 bucket แยกที่เป็น private) และห้าม commit ขึ้น Git

set -eu

cd "$(dirname "$0")/.."

KEEP="${KEEP:-14}"
BACKUP_DIR="backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/finance-$STAMP.dump"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# pg_dump รันใน container db (มีเวอร์ชันตรงกับ server อยู่แล้ว)
# -Fc = custom format: บีบอัดแล้ว และกู้คืนด้วย pg_restore ได้ทีละตาราง
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$FILE.tmp"

# เขียนลงไฟล์ชั่วคราวก่อน — ถ้า pg_dump ล้มกลางทาง จะไม่ได้ไฟล์ครึ่ง ๆ ที่ดูเหมือนสมบูรณ์
mv "$FILE.tmp" "$FILE"
chmod 600 "$FILE"
echo "$(date -Iseconds) backup saved: $FILE ($(du -h "$FILE" | cut -f1))"

# ลบไฟล์เก่าเกิน KEEP ไฟล์ (ชื่อไฟล์เรียงตามเวลาอยู่แล้ว)
ls -1 "$BACKUP_DIR"/finance-*.dump | sort -r | tail -n +"$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
  echo "removed old backup: $old"
done
