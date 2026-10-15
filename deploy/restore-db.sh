#!/bin/sh
# กู้ฐานข้อมูลจากไฟล์ที่ได้จาก backup-db.sh
#
#   ./deploy/restore-db.sh backups/finance-20261015-030000.dump
#
# ⚠️ เขียนทับข้อมูลปัจจุบันทั้งหมด — สคริปต์จะถามยืนยันก่อน
set -eu

cd "$(dirname "$0")/.."

if [ $# -ne 1 ] || [ ! -f "$1" ]; then
  echo "usage: $0 <backup-file.dump>" >&2
  exit 1
fi

COMPOSE="docker compose -f docker-compose.prod.yml"

printf 'Restore %s and REPLACE all current data? Type "restore" to continue: ' "$1"
read -r answer
[ "$answer" = "restore" ] || { echo "Cancelled."; exit 1; }

# หยุดแอปก่อน ไม่ให้มีคนเขียนข้อมูลระหว่างกู้
$COMPOSE stop app

# --clean --if-exists: ลบตารางเดิมก่อนสร้างจาก backup
# --single-transaction: ถ้าพังกลางทาง ข้อมูลเดิมยังอยู่ครบ
$COMPOSE exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' < "$1"

$COMPOSE start app
echo "Restored from $1"
