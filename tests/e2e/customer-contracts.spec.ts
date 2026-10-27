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

function versionFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { version } = value as { version?: unknown };
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0
    ? version
    : null;
}

test("customer detail enters a server-scoped contract list and detail without a navigation entry", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Contract Customer ${suffix}`;
  const contractName = `E2E Contract ${suffix}`;
  const contractNumber = `E2E-CT-${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: { customerId, name: contractName, number: contractNumber, products: [] },
    headers,
  });
  expect(contractResponse.ok()).toBeTruthy();
  const contract = await contractResponse.json();
  const contractId = identifierFrom(contract);
  expect(contractId).not.toBeNull();
  if (contractId === null) throw new Error("Contract did not return an ID.");
  const contractVersion = versionFrom(contract);
  expect(contractVersion).not.toBeNull();
  if (contractVersion === null) throw new Error("Contract did not return a version.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  const contractRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contracts/query" && request.method() === "POST",
  );
  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "查看合同" }).click();

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/contracts`);
  await expect(page.getByRole("heading", { name: "客户合同", exact: true })).toBeVisible();
  await expect(
    page.getByLabel("桌面列表").getByText(contractNumber, { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("桌面列表").getByText(contractName, { exact: true })).toBeVisible();
  expect((await contractRequest).postDataJSON()).toEqual({
    customerId,
    page: 1,
    size: 15,
  });

  const detailRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/contracts/${contractId}` &&
      request.method() === "GET",
  );
  await page.getByLabel("桌面列表").getByRole("link", { name: contractNumber }).click();
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/contracts/${contractId}`);
  await expect(page.getByRole("heading", { name: contractName, exact: true })).toBeVisible();
  await expect(page.getByText(contractNumber, { exact: true })).toBeVisible();
  await detailRequest;

  const deletion = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/contracts/${contractId}` &&
      request.method() === "DELETE",
  );
  await page.getByRole("button", { name: "删除合同", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();

  expect(new URL((await deletion).url()).searchParams.get("version")).toBe(String(contractVersion));
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/contracts`);
});

test("customer contract void submits only the returned version and refreshes the detail", async ({
  page,
}) => {
  const suffix = Date.now();
  const contractName = `E2E Void Contract ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Void Contract Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: contractName,
      number: `E2E-VOID-${suffix}`,
      products: [],
    },
    headers,
  });
  expect(contractResponse.ok()).toBeTruthy();
  const contract = await contractResponse.json();
  const contractId = identifierFrom(contract);
  expect(contractId).not.toBeNull();
  if (contractId === null) throw new Error("Contract did not return an ID.");
  const contractVersion = versionFrom(contract);
  expect(contractVersion).not.toBeNull();
  if (contractVersion === null) throw new Error("Contract did not return a version.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/contracts/${contractId}`, {
    waitUntil: "networkidle",
  });
  await expect(page.getByRole("heading", { name: contractName, exact: true })).toBeVisible();

  const voidRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/contracts/${contractId}/void` &&
      request.method() === "PUT",
  );
  const refreshedDetail = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/contracts/${contractId}` &&
      request.method() === "GET",
  );
  await page.getByRole("button", { name: "作废合同", exact: true }).click();
  await page.getByRole("button", { name: "确认作废", exact: true }).click();

  expect((await voidRequest).postDataJSON()).toEqual({ version: contractVersion });
  await refreshedDetail;
  await expect(page.getByText("VOIDED", { exact: true })).toBeVisible();
});

test("customer contract creation submits only the generated minimum request", async ({ page }) => {
  const suffix = Date.now();
  const customerName = `E2E Contract Create Customer ${suffix}`;
  const contractName = `E2E Created Contract ${suffix}`;
  const contractNumber = `E2E-NEW-${suffix}`;
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
  await page.goto(`${baseUrl}/crm/customers/${customerId}/contracts`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建合同" }).click();
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/contracts/new`);

  const createRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contracts" && request.method() === "POST",
  );
  await page.getByLabel("合同名称").fill(contractName);
  await page.getByLabel("合同编号").fill(contractNumber);
  await page.getByRole("button", { name: "创建合同" }).click();

  const request = await createRequest;
  expect(request.postDataJSON()).toEqual({
    customerId,
    discountRate: 0,
    name: contractName,
    number: contractNumber,
    products: [],
  });
  const response = await request.response();
  const created = response === null ? null : identifierFrom(await response.json());
  expect(created).not.toBeNull();
  if (created === null) throw new Error("Contract did not return an ID.");
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/contracts/${created}`);
  await expect(page.getByRole("heading", { name: contractName, exact: true })).toBeVisible();
});

test("customer contract creation selects products only from the server-visible catalog", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Contract Product Customer ${suffix}`;
  const productName = `E2E Contract Product ${suffix}`;
  const productCode = `E2E-PROD-${suffix}`;
  const contractName = `E2E Product Contract ${suffix}`;
  const contractNumber = `E2E-PROD-CT-${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: { code: productCode, listPrice: 100, name: productName },
    headers,
  });
  expect(productResponse.ok()).toBeTruthy();
  const productId = identifierFrom(await productResponse.json());
  expect(productId).not.toBeNull();
  if (productId === null) throw new Error("Product did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/contracts/new`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "选择产品" }).click();
  const productDialog = page.getByRole("dialog", { name: "选择合同产品" });
  const productQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/products/query" &&
      request.method() === "POST" &&
      request.postData()?.includes(productName) === true,
  );
  await productDialog.getByPlaceholder("按产品名称或编码搜索").fill(productName);
  expect((await productQuery).postDataJSON()).toEqual({
    keyword: productName,
    page: 1,
    size: 50,
  });
  const productItem = productDialog
    .getByText(productName, { exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(productItem).toBeVisible();
  await productItem.getByRole("button", { name: "选择" }).click();
  await expect(productDialog).toBeHidden();
  await expect(page.getByLabel(`${productName} 数量`)).toHaveValue("1");

  await page.getByLabel("合同名称").fill(contractName);
  await page.getByLabel("合同编号").fill(contractNumber);
  const createRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contracts" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建合同" }).click();
  expect((await createRequest).postDataJSON()).toEqual({
    customerId,
    discountRate: 0,
    name: contractName,
    number: contractNumber,
    products: [{ productId, quantity: 1 }],
  });
});
