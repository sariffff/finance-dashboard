# syntax=docker/dockerfile:1
#
# Dockerfile สำหรับ production — สร้าง image แบบหลายขั้น (multi-stage)
# แต่ละ FROM คือ "ขั้น" แยกกัน ขั้นหลัง ๆ หยิบเฉพาะไฟล์ที่ต้องใช้จากขั้นก่อนหน้า
# image สุดท้ายจึงเล็ก มีแค่ตัวแอปที่ build แล้ว ไม่มี source code หรือเครื่องมือ build
#
#   docker build -t finance-dashboard .                     # image ของแอป (ขั้น runner)
#   docker build -t finance-dashboard-migrate --target migrator .   # image สำหรับรัน migration/seed
#
# ความลับ (DATABASE_URL, BETTER_AUTH_SECRET, ...) ไม่ถูกใส่ใน image
# ส่งเข้าไปตอนรัน container เท่านั้น (เช่น ผ่าน docker compose + ไฟล์ .env)

# ---------- base: Node.js ตัวเดียวกันทุกขั้น ----------
FROM node:22.23.3-alpine3.24 AS base
# Next.js ส่งสถิติการใช้งาน และ npm แจ้งเตือนเวอร์ชันใหม่โดยค่าเริ่มต้น — ปิดทั้งคู่
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

# ---------- deps: ติดตั้ง package ตาม package-lock.json ----------
# copy แค่ไฟล์ package ก่อน: ถ้า dependency ไม่เปลี่ยน Docker ใช้ cache ขั้นนี้ซ้ำได้ build เร็วขึ้น
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder: build แอป ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# ตอน build ยังไม่มีความลับ — ข้ามการตรวจ env เฉพาะขั้นนี้ (ดู src/env.ts)
ENV SKIP_ENV_VALIDATION=1
RUN npm run build

# ---------- migrator: รัน database migration และ seed ----------
# ต้องใช้ drizzle-kit กับ tsx (devDependencies) จึงแยกเป็น image ของตัวเอง ไม่ปนกับแอป
FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src
CMD ["npm", "run", "db:migrate"]

# ---------- runner: image ที่ใช้รันจริง ----------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# ไม่รันด้วย root: ถ้าแอปถูกเจาะ ผู้บุกรุกจะได้สิทธิ์แค่ user นี้
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
# standalone = server.js + เฉพาะ node_modules ที่แอปใช้จริง (Next.js คำนวณให้)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
# ให้ Docker เช็คว่าแอปยังตอบอยู่ (ใช้ wget ที่มีใน alpine อยู่แล้ว)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
