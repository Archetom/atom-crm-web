import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("lead detail edits a server-created visible lead with its current version", async ({
  page,
}) => {
  const name = `E2E Lead Edit ${Date.now()}`;
  const description = "E2E 更新后的线索说明";
  const customerName = `${name} Customer`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers: {
      "X-Dev-Tenant-Id": "900001",
      "X-Dev-User-Id": "900001",
    },
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerPayload: unknown = await customerResponse.json();
  const customerId =
    customerPayload !== null &&
    typeof customerPayload === "object" &&
    typeof (customerPayload as { id?: unknown }).id === "number"
      ? (customerPayload as { id: number }).id
      : null;
  expect(customerId).not.toBeNull();
  const response = await page.request.post(`${baseUrl}/api/v1/leads`, {
    data: { jobTitle: "采购经理", name },
    headers: {
      "X-Dev-Tenant-Id": "900001",
      "X-Dev-User-Id": "900001",
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload: unknown = await response.json();
  const leadId =
    payload !== null &&
    typeof payload === "object" &&
    typeof (payload as { id?: unknown }).id === "number"
      ? (payload as { id: number }).id
      : null;
  expect(leadId).not.toBeNull();

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/leads/${leadId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "编辑基础信息" }).click();
  await expect(page.getByRole("heading", { name: "编辑线索" })).toBeVisible();
  await page.locator("textarea").fill(description);
  await page.getByRole("button", { name: "保存修改" }).click();

  await expect(page).toHaveURL(/\/crm\/leads\/\d+$/);
  await expect(page.getByText(description)).toBeVisible();

  await page.getByRole("button", { name: "关联客户" }).click();
  const customerDialog = page.getByRole("dialog", { name: "关联客户" });
  await expect(customerDialog).toBeVisible();
  const customerSearch = customerDialog.getByPlaceholder("搜索可见客户");
  await customerSearch.fill(customerName);
  await customerSearch.press("Enter");
  await customerDialog.getByRole("button", { name: "关联" }).click();
  await expect(customerDialog).toBeHidden();
  await expect(page.getByText(String(customerId), { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "关联客户" }).click();
  const clearButton = customerDialog.getByRole("button", {
    name: `清除当前关联客户（${customerId}）`,
  });
  await clearButton.click();
  const clearConfirmation = page.getByRole("tooltip", { name: "确认清除当前关联客户吗？" });
  await expect(clearConfirmation).toBeVisible();
  await clearConfirmation.getByRole("button", { name: /^清\s*除$/ }).click();
  await expect(customerDialog).toBeHidden();
  const clearedLeadResponse = await page.request.get(`${baseUrl}/api/v1/leads/${leadId}`, {
    headers: {
      "X-Dev-Tenant-Id": "900001",
      "X-Dev-User-Id": "900001",
    },
  });
  expect(clearedLeadResponse.ok()).toBeTruthy();
  const clearedLeadPayload: unknown = await clearedLeadResponse.json();
  expect(
    clearedLeadPayload !== null &&
      typeof clearedLeadPayload === "object" &&
      !Array.isArray(clearedLeadPayload)
      ? (clearedLeadPayload as { customerId?: unknown }).customerId
      : undefined,
  ).toBeNull();

  await page.getByRole("button", { name: "关注" }).click();
  await expect(page.getByRole("button", { name: "取消关注" })).toBeVisible();
  await page.getByRole("button", { name: "取消关注" }).click();
  await expect(page.getByRole("button", { name: "关注" })).toBeVisible();
});
