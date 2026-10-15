import { expect, test } from "@playwright/test";

import { formAlert, open, signUpNewUser } from "./helpers";

test("redirects to sign-in when not logged in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("button", { name: "เข้าสู่ระบบ" })).toBeVisible();
});

test("signs up, signs out and signs back in", async ({ page }) => {
  const { email } = await signUpNewUser(page);
  // A new account starts empty.
  await expect(page.getByRole("heading", { name: "ยังไม่มีข้อมูล" })).toBeVisible();

  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).not.toHaveURL(/\/dashboard/);
  await open(page, "/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);

  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill("e2e-password-1234");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("rejects a wrong password", async ({ page }) => {
  await open(page, "/sign-in");
  await page.getByLabel("อีเมล").fill("nobody@e2e.finance.test");
  await page.getByLabel("รหัสผ่าน").fill("wrong-password-1234");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(formAlert(page)).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
});
