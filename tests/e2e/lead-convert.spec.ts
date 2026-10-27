import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const ownerHeaders = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function responseId(value: unknown): number | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "number"
    ? (value as { id: number }).id
    : null;
}

test("a lead converts with its current version and opens only returned records", async ({
  page,
}) => {
  const suffix = Date.now();
  const leadName = `E2E Lead Convert ${suffix}`;
  const leadResponse = await page.request.post(`${baseUrl}/api/v1/leads`, {
    data: { jobTitle: "初始职务", name: leadName },
    headers: ownerHeaders,
  });
  expect(leadResponse.ok()).toBeTruthy();
  const leadId = responseId(await leadResponse.json());
  expect(leadId).not.toBeNull();

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/leads/${leadId}`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "转换为客户和联系人" }).click();
  const dialog = page.getByRole("dialog", { name: "转换线索" });
  await dialog.getByLabel("转换客户名称").fill(`${leadName} 客户`);
  await dialog.getByLabel("转换联系人名称").fill(`${leadName} 联系人`);
  await dialog.getByLabel("转换联系人职务").fill("采购经理");
  await dialog.getByRole("button", { name: "确认转换" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "查看新建客户" })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看新建联系人" })).toBeVisible();
  await page.getByRole("button", { name: "查看新建客户" }).click();
  await expect(page).toHaveURL(/\/crm\/customers\/\d+$/);
});
