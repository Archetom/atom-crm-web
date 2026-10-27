import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function identifierFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { id } = value as { id?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function requestIncludesKeyword(value: unknown, keyword: string): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const { keyword: requestKeyword } = value as { keyword?: unknown };
  return requestKeyword === keyword;
}

test("lead creation redirects to the server-returned detail record", async ({ page }) => {
  const name = `E2E Web Lead ${Date.now()}`;
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });

  await page.goto(`${baseUrl}/crm/leads/new`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "新建线索" })).toBeVisible();

  await page.getByPlaceholder("请输入线索名称").fill(name);
  await page.getByPlaceholder("请输入职务").fill("采购经理");
  await page.getByPlaceholder("例如 +8613812345678").fill("+8613812345678");
  await page.getByRole("button", { name: "创建线索" }).click();

  await expect(page).toHaveURL(/\/crm\/leads\/\d+$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("采购经理", { exact: true })).toBeVisible();

  await page.goto(`${baseUrl}/crm/leads/new`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("请输入线索名称").fill(name);
  await page.getByRole("button", { name: "检查重复" }).click();
  await expect(page.getByText("发现当前可见范围内存在重复线索，请核对后再创建。")).toBeVisible();
});

test("lead creation confirms a selected server-visible customer before submitting it", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Lead Customer ${suffix}`;
  const leadName = `E2E Lead Customer Relation ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/leads/new`, { waitUntil: "networkidle" });
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
  await page.getByPlaceholder("请输入线索名称").fill(leadName);

  const leadRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/api/v1/leads" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建线索" }).click();

  expect((await leadRequest).postDataJSON()).toMatchObject({ name: leadName, customerId });
  await expect(page).toHaveURL(/\/crm\/leads\/\d+$/);
});

test("lead creation sends only explicitly entered tags", async ({ page }) => {
  const suffix = Date.now();
  const leadName = `E2E Lead Tags ${suffix}`;
  const tag = `重点线索${suffix}`;
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/leads/new`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("请输入线索名称").fill(leadName);
  await page.getByLabel("线索标签").fill(tag);
  await page.getByLabel("线索标签").press("Enter");

  const leadRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/api/v1/leads" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建线索" }).click();

  expect((await leadRequest).postDataJSON()).toMatchObject({ name: leadName, tags: [tag] });
  await expect(page).toHaveURL(/\/crm\/leads\/\d+$/);
});
