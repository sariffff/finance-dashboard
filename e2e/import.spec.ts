import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_PASSWORD } from "../src/lib/parsers/__fixtures__/scb-sample-data";

import { formAlert, open, signUpNewUser } from "./helpers";

// The fictional, password-protected SCB statement used by the parser tests.
const SCB_PDF = resolve("src/lib/parsers/__fixtures__/scb-statement.pdf");

async function uploadStatement(page: Page, password: string) {
  await open(page, "/dashboard/import");
  await page.getByLabel("ไฟล์ statement (PDF)").setInputFiles(SCB_PDF);
  await page.getByLabel("รหัสผ่าน PDF").fill(password);
  await page.getByRole("button", { name: "อ่านไฟล์และดูตัวอย่าง" }).click();
}

test("imports an SCB statement: preview, save, and skip duplicates on re-import", async ({ page }) => {
  // Sign-up, three PDF uploads and a save: longer than the default 30s budget.
  test.slow();
  await signUpNewUser(page);

  // 1. Add a bank account.
  await page.getByRole("link", { name: "นำเข้า statement แรก" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("ธนาคาร").selectOption("scb");
  await page.getByLabel("ชื่อบัญชี").fill("บัญชีทดสอบ SCB");
  await page.getByRole("button", { name: "เพิ่มบัญชี" }).click();
  await expect(page.getByLabel("บัญชีธนาคาร")).toBeVisible();

  // 2. A wrong PDF password is reported clearly and nothing is imported.
  await uploadStatement(page, "00000000");
  await expect(formAlert(page)).toContainText("รหัสผ่าน PDF ไม่ถูกต้อง");

  // 3. The right password shows the preview; nothing is saved yet.
  await uploadStatement(page, FIXTURE_PASSWORD);
  await expect(page.getByRole("heading", { name: "ตรวจรายการก่อนบันทึก" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const saveButton = page.getByRole("button", { name: /^บันทึก \d+ รายการ$/ });
  const label = await saveButton.textContent();
  const rowCount = Number(label?.match(/\d+/)?.[0]);
  expect(rowCount).toBeGreaterThan(30);

  // 4. Save: every row is new and most are categorized by the system rules
  //    (no API key in tests, so no AI).
  await saveButton.click();
  await expect(page.getByRole("heading", { name: "บันทึกเรียบร้อย" })).toBeVisible();
  await expect(page.getByText(`เพิ่ม ${rowCount} รายการใหม่`)).toBeVisible();

  // 5. The same file again: every row is a duplicate.
  await uploadStatement(page, FIXTURE_PASSWORD);
  await expect(page.getByRole("heading", { name: "ตรวจรายการก่อนบันทึก" })).toBeVisible();
  await expect(page.getByRole("button", { name: "บันทึก 0 รายการ" })).toBeVisible();

  // 6. The transactions show up in the list.
  await open(page, "/dashboard/transactions");
  await expect(page.getByText("NETFLIX.COM").first()).toBeVisible();
});
