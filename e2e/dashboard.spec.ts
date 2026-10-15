import { expect, test } from "@playwright/test";

import { open } from "./helpers";

// The demo account holds 12 months of seeded data (npm run db:seed).
// These tests only read it, so they can share the account safely.

test.beforeEach(async ({ page }) => {
  await open(page, "/sign-in");
  await page.getByRole("button", { name: "ลองใช้ด้วยบัญชีตัวอย่าง" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("shows the monthly summary, charts and recent transactions", async ({ page }) => {
  for (const label of ["รายรับ", "รายจ่าย", "คงเหลือ"]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText("รายจ่ายตามหมวดหมู่")).toBeVisible();
  await expect(page.getByText(/^แนวโน้ม \d+ เดือน$/)).toBeVisible();
  await expect(page.getByText("รายการล่าสุด")).toBeVisible();
  // Amounts are rendered in baht.
  await expect(page.getByText(/฿/).first()).toBeVisible();
});

test("searches the transaction list", async ({ page }) => {
  await page.getByRole("link", { name: "รายการธุรกรรม" }).click();
  await expect(page).toHaveURL(/\/dashboard\/transactions/);
  await page.waitForLoadState("networkidle");

  await page.getByRole("searchbox").fill("netflix");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/q=netflix/i);
  await expect(page.getByText("NETFLIX.COM").first()).toBeVisible();
  await expect(page.getByText("SPOTIFY")).toHaveCount(0);
});
