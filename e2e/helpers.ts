import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";

/** Every account the tests create uses this domain; global-teardown removes them. */
export const E2E_EMAIL_DOMAIN = "e2e.finance.test";

/**
 * Navigate and wait until React has hydrated. Forms use server actions with
 * client-side state; a click that lands before hydration falls back to a
 * plain form post and the test then races a full page reload. `next dev`
 * compiles each page on first visit, so this matters most locally.
 */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Error messages inside forms (Next.js also renders an empty role=alert route announcer). */
export const formAlert = (page: Page) => page.locator("form [role=alert]");

/** Sign up a brand-new user and land on the (empty) dashboard. */
export async function signUpNewUser(page: Page, name = "ผู้ทดสอบ E2E") {
  const email = `user-${randomUUID()}@${E2E_EMAIL_DOMAIN}`;
  await open(page, "/sign-up");
  await page.getByLabel("ชื่อ").fill(name);
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill("e2e-password-1234");
  await page.getByRole("button", { name: "สมัครสมาชิก" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: `สวัสดี, ${name}` })).toBeVisible();
  return { email };
}
