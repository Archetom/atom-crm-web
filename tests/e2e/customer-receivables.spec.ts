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

function textFrom(value: unknown, key: string): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

test("customer detail enters money-free server-scoped receivable list and detail without a navigation entry", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Receivable Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: { code: `E2E-RV-P-${suffix}`, listPrice: 100, name: `E2E Receivable Product ${suffix}` },
    headers,
  });
  expect(productResponse.ok()).toBeTruthy();
  const productId = identifierFrom(await productResponse.json());
  expect(productId).not.toBeNull();
  if (productId === null) throw new Error("Product did not return an ID.");

  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Receivable Contract ${suffix}`,
      number: `E2E-RV-${suffix}`,
      products: [{ productId, quantity: 1 }],
    },
    headers,
  });
  expect(contractResponse.ok()).toBeTruthy();
  const contractId = identifierFrom(await contractResponse.json());
  expect(contractId).not.toBeNull();
  if (contractId === null) throw new Error("Contract did not return an ID.");

  const receivableResponse = await page.request.post(`${baseUrl}/api/v1/receivables`, {
    data: {
      amount: 12.34,
      contractId,
      paymentMethod: "TRANSFER",
      receivedDate: "2026-07-26",
    },
    headers,
  });
  expect(receivableResponse.ok()).toBeTruthy();
  const receivable = await receivableResponse.json();
  const receivableId = identifierFrom(receivable);
  expect(receivableId).not.toBeNull();
  if (receivableId === null) throw new Error("Receivable did not return an ID.");
  const receivableVersion = versionFrom(receivable);
  expect(receivableVersion).not.toBeNull();
  if (receivableVersion === null) throw new Error("Receivable did not return a version.");
  const receiptNumber = textFrom(receivable, "receiptNumber");
  expect(receiptNumber).not.toBeNull();
  if (receiptNumber === null) throw new Error("Receivable did not return a receipt number.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  const receivableQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/receivables/query" &&
      request.method() === "POST",
  );
  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "查看回款", exact: true }).click();

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/receivables`);
  await expect(page.getByRole("heading", { name: "客户回款", exact: true })).toBeVisible();
  await expect(page.getByLabel("桌面列表").getByText(receiptNumber, { exact: true })).toBeVisible();
  expect((await receivableQuery).postDataJSON()).toEqual({ customerId, page: 1, size: 15 });

  const detailRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/receivables/${receivableId}` &&
      request.method() === "GET",
  );
  await page.getByLabel("桌面列表").getByRole("link", { name: receiptNumber }).click();

  await expect(page).toHaveURL(
    `${baseUrl}/crm/customers/${customerId}/receivables/${receivableId}`,
  );
  await expect(page.getByRole("heading", { name: receiptNumber, exact: true })).toBeVisible();
  await detailRequest;

  const deletion = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/receivables/${receivableId}` &&
      request.method() === "DELETE",
  );
  await page.getByRole("button", { name: "删除回款", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();

  expect(new URL((await deletion).url()).searchParams.get("version")).toBe(
    String(receivableVersion),
  );
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/receivables`);
});

test("customer detail creates an unplanned receivable from a server-visible contract", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Create Receivable Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-CRV-P-${suffix}`,
      listPrice: 100,
      name: `E2E Create Receivable Product ${suffix}`,
    },
    headers,
  });
  expect(productResponse.ok()).toBeTruthy();
  const productId = identifierFrom(await productResponse.json());
  expect(productId).not.toBeNull();
  if (productId === null) throw new Error("Product did not return an ID.");

  const contractNumber = `E2E-CRV-${suffix}`;
  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Create Receivable Contract ${suffix}`,
      number: contractNumber,
      products: [{ productId, quantity: 1 }],
    },
    headers,
  });
  expect(contractResponse.ok()).toBeTruthy();
  const contractId = identifierFrom(await contractResponse.json());
  expect(contractId).not.toBeNull();
  if (contractId === null) throw new Error("Contract did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建回款", exact: true }).click();

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/receivables/new`);
  const contractQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contracts/query" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "选择合同", exact: true }).click();
  expect((await contractQuery).postDataJSON()).toEqual({ customerId, page: 1, size: 50 });
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: new RegExp(contractNumber) }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /选\s*择/ })
    .click();

  await page.getByLabel("到账日期").fill("2026-07-26");
  await page.getByLabel("回款金额").fill("12.34");
  await page.getByLabel("收款方式").fill("TRANSFER");
  const receivableCreate = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/receivables" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建回款", exact: true }).click();

  const receivableCreateRequest = await receivableCreate;
  expect(receivableCreateRequest.postDataJSON()).toEqual({
    amount: 12.34,
    contractId,
    paymentMethod: "TRANSFER",
    receivedDate: "2026-07-26",
  });
  const receivableResponse = await receivableCreateRequest.response();
  expect(receivableResponse?.ok()).toBeTruthy();
  const receivableId = identifierFrom(await receivableResponse?.json());
  expect(receivableId).not.toBeNull();
  if (receivableId === null) throw new Error("Receivable did not return an ID.");

  await expect(page).toHaveURL(
    `${baseUrl}/crm/customers/${customerId}/receivables/${receivableId}`,
  );
});
