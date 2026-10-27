import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function customerIdFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { id } = value as { id?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function requestIncludesKeyword(value: unknown, keyword: string): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const { keyword: requestKeyword } = value as { keyword?: unknown };
  return requestKeyword === keyword;
}

test("global contact creation confirms a selected server-visible customer before submitting it", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Contact Customer ${suffix}`;
  const contactName = `E2E Contact Customer Relation ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = customerIdFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/contacts/new`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "选择客户" }).click();
  const customerQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/customers/query" &&
      request.method() === "POST" &&
      requestIncludesKeyword(request.postDataJSON(), customerName),
  );
  await page.getByLabel("搜索可见客户").fill(customerName);
  await customerQuery;
  const detailRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/customers/${customerId}` &&
      request.method() === "GET",
  );
  await page
    .getByRole("dialog", { name: "选择关联客户" })
    .getByRole("button", { name: "选择客户", exact: true })
    .click();
  await detailRequest;
  await expect(page.getByText(`将关联到客户：${customerName}`, { exact: true })).toBeVisible();
  await page.getByPlaceholder("请输入联系人姓名").fill(contactName);
  const contactRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contacts" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建联系人" }).click();

  expect((await contactRequest).postDataJSON()).toMatchObject({ name: contactName, customerId });
  await expect(page).toHaveURL(/\/crm\/contacts\/\d+$/);
});
