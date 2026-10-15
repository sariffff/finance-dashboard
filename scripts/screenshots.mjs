// Capture README screenshots from the running app as the demo user.
//   npm run build && npm run start     # in another terminal (after npm run db:seed)
//   node scripts/screenshots.mjs
import { mkdir } from "node:fs/promises";

import { chromium, devices } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "docs/images";

// The current month is still in progress (payday hasn't come yet), so show
// the last complete one.
const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const MONTH = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;

async function signedInPage(browser, device) {
  const context = await browser.newContext({ ...device, locale: "th-TH", timezoneId: "Asia/Bangkok", colorScheme: "light" });
  const page = await context.newPage();
  await page.goto(`${BASE}/sign-in`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "ลองใช้ด้วยบัญชีตัวอย่าง" }).click();
  await page.getByText("รายรับ", { exact: true }).first().waitFor();
  return page;
}

/**
 * Grow the viewport to the whole page before shooting instead of using
 * `fullPage`: that option resizes the page mid-capture, which makes Recharts
 * re-render and restart its bar animation from zero.
 */
async function shoot(page, path, { full = true } = {}) {
  await page.waitForLoadState("networkidle");
  if (full) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: page.viewportSize().width, height });
  }
  await page.waitForTimeout(2000); // let chart animations finish
  await page.screenshot({ path });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

const desktop = await signedInPage(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await desktop.goto(`${BASE}/dashboard?month=${MONTH}`);
await desktop.getByText("รายจ่ายตามหมวดหมู่").waitFor();
await shoot(desktop, `${OUT}/dashboard.png`);

await desktop.setViewportSize({ width: 1440, height: 900 });
await desktop.goto(`${BASE}/dashboard/transactions?month=${MONTH}`);
await desktop.getByRole("searchbox").waitFor();
await shoot(desktop, `${OUT}/transactions.png`, { full: false });

const mobile = await signedInPage(browser, devices["Pixel 7"]);
await mobile.goto(`${BASE}/dashboard?month=${MONTH}`);
await mobile.getByText("รายจ่ายตามหมวดหมู่").waitFor();
await shoot(mobile, `${OUT}/dashboard-mobile.png`, { full: false });

await browser.close();
console.log(`Saved screenshots of ${MONTH} to ${OUT}/`);
