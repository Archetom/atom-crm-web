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

function textFrom(value: unknown, key: string): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

function versionFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { version } = value as { version?: unknown };
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0
    ? version
    : null;
}

test("customer detail enters money-free server-scoped invoice list and detail without a navigation entry", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Invoice Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: { code: `E2E-IV-P-${suffix}`, listPrice: 100, name: `E2E Invoice Product ${suffix}` },
    headers,
  });
  expect(productResponse.ok()).toBeTruthy();
  const productId = identifierFrom(await productResponse.json());
  expect(productId).not.toBeNull();
  if (productId === null) throw new Error("Product did not return an ID.");

  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Invoice Contract ${suffix}`,
      number: `E2E-IV-${suffix}`,
      products: [{ productId, quantity: 1 }],
    },
    headers,
  });
  expect(contractResponse.ok()).toBeTruthy();
  const contractId = identifierFrom(await contractResponse.json());
  expect(contractId).not.toBeNull();
  if (contractId === null) throw new Error("Contract did not return an ID.");

  const invoiceResponse = await page.request.post(`${baseUrl}/api/v1/invoices`, {
    data: {
      amount: 12.34,
      contractId,
      invoiceType: "VAT",
      taxNumber: `TAX-${suffix}`,
      title: `E2E Invoice Title ${suffix}`,
      titleType: "ORGANIZATION",
    },
    headers,
  });
  expect(invoiceResponse.ok()).toBeTruthy();
  const invoice = await invoiceResponse.json();
  const invoiceId = identifierFrom(invoice);
  expect(invoiceId).not.toBeNull();
  if (invoiceId === null) throw new Error("Invoice did not return an ID.");
  const invoiceVersion = versionFrom(invoice);
  expect(invoiceVersion).not.toBeNull();
  if (invoiceVersion === null) throw new Error("Invoice did not return a version.");
  const applicationNumber = textFrom(invoice, "applicationNumber");
  expect(applicationNumber).not.toBeNull();
  if (applicationNumber === null) throw new Error("Invoice did not return an application number.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  const invoiceQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/invoices/query" && request.method() === "POST",
  );
  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "查看发票" }).click();

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/invoices`);
  await expect(page.getByRole("heading", { name: "客户发票", exact: true })).toBeVisible();
  await expect(
    page.getByLabel("桌面列表").getByText(applicationNumber, { exact: true }),
  ).toBeVisible();
  expect((await invoiceQuery).postDataJSON()).toEqual({ customerId, page: 1, size: 15 });

  const detailRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/invoices/${invoiceId}` &&
      request.method() === "GET",
  );
  await page.getByLabel("桌面列表").getByRole("link", { name: applicationNumber }).click();

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/invoices/${invoiceId}`);
  await expect(page.getByRole("heading", { name: applicationNumber, exact: true })).toBeVisible();
  await detailRequest;

  const deleteRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/invoices/${invoiceId}` &&
      request.method() === "DELETE",
  );
  await page.getByRole("button", { name: "删除发票", exact: true }).click();
  await page.getByRole("button", { name: /确认删除/ }).click();
  expect(new URL((await deleteRequest).url()).searchParams.get("version")).toBe(
    String(invoiceVersion),
  );
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/invoices`);
});

test("an issued invoice reset submits only its returned version and refreshes the detail", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Reset Invoice Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-RIV-P-${suffix}`,
      listPrice: 100,
      name: `E2E Reset Invoice Product ${suffix}`,
    },
    headers,
  });
  expect(productResponse.ok()).toBeTruthy();
  const productId = identifierFrom(await productResponse.json());
  expect(productId).not.toBeNull();
  if (productId === null) throw new Error("Product did not return an ID.");

  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Reset Invoice Contract ${suffix}`,
      number: `E2E-RIV-${suffix}`,
      products: [{ productId, quantity: 1 }],
    },
    headers,
  });
  expect(contractResponse.ok()).toBeTruthy();
  const contractId = identifierFrom(await contractResponse.json());
  expect(contractId).not.toBeNull();
  if (contractId === null) throw new Error("Contract did not return an ID.");

  const invoiceResponse = await page.request.post(`${baseUrl}/api/v1/invoices`, {
    data: {
      amount: 12.34,
      contractId,
      invoiceType: "VAT",
      taxNumber: `TAX-R-${suffix}`,
      title: `E2E Reset Invoice Title ${suffix}`,
      titleType: "ORGANIZATION",
    },
    headers,
  });
  expect(invoiceResponse.ok()).toBeTruthy();
  const invoice = await invoiceResponse.json();
  const invoiceId = identifierFrom(invoice);
  const invoiceVersion = versionFrom(invoice);
  expect(invoiceId).not.toBeNull();
  expect(invoiceVersion).not.toBeNull();
  if (invoiceId === null || invoiceVersion === null) {
    throw new Error("Invoice did not return an ID and version.");
  }

  const issueResponse = await page.request.put(`${baseUrl}/api/v1/invoices/${invoiceId}/issue`, {
    data: {
      invoiceNumber: `E2E-ISSUED-${suffix}`,
      issuedDate: "2026-07-26",
      version: invoiceVersion,
    },
    headers,
  });
  expect(issueResponse.ok()).toBeTruthy();
  const issuedInvoice = await issueResponse.json();
  const issuedVersion = versionFrom(issuedInvoice);
  expect(issuedVersion).not.toBeNull();
  if (issuedVersion === null) throw new Error("Issued invoice did not return a version.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/invoices/${invoiceId}`, {
    waitUntil: "networkidle",
  });
  await expect(page.getByText("ISSUED", { exact: true })).toBeVisible();

  const resetRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/invoices/${invoiceId}/reset` &&
      request.method() === "PUT",
  );
  const refreshedDetail = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/invoices/${invoiceId}` &&
      request.method() === "GET",
  );
  await page.getByRole("button", { name: "重置开票结果", exact: true }).click();
  await page.getByRole("button", { name: "确认重置", exact: true }).click();

  expect((await resetRequest).postDataJSON()).toEqual({ version: issuedVersion });
  await refreshedDetail;
  await expect(page.getByText("PENDING", { exact: true })).toBeVisible();
});

test("customer detail creates a personal invoice from a server-visible contract", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Personal Invoice Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-PIV-P-${suffix}`,
      listPrice: 100,
      name: `E2E Personal Invoice Product ${suffix}`,
    },
    headers,
  });
  expect(productResponse.ok()).toBeTruthy();
  const productId = identifierFrom(await productResponse.json());
  expect(productId).not.toBeNull();
  if (productId === null) throw new Error("Product did not return an ID.");

  const contractNumber = `E2E-PIV-${suffix}`;
  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Personal Invoice Contract ${suffix}`,
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
  await page.getByRole("button", { name: "新建发票", exact: true }).click();

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/invoices/new`);
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

  await page.getByLabel("发票金额").fill("12.34");
  await page.getByLabel("申请日期").fill("2026-08-26");
  await page.getByLabel("发票类型").fill("VAT");
  await page.getByLabel("开票抬头").fill(`E2E Personal Invoice Title ${suffix}`);
  const invoiceCreate = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/invoices" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建发票申请", exact: true }).click();

  const invoiceCreateRequest = await invoiceCreate;
  expect(invoiceCreateRequest.postDataJSON()).toEqual({
    amount: 12.34,
    contractId,
    invoiceType: "VAT",
    requestedDate: "2026-08-26",
    title: `E2E Personal Invoice Title ${suffix}`,
    titleType: "INDIVIDUAL",
  });
  const invoiceResponse = await invoiceCreateRequest.response();
  expect(invoiceResponse?.ok()).toBeTruthy();
  const invoiceId = identifierFrom(await invoiceResponse?.json());
  expect(invoiceId).not.toBeNull();
  if (invoiceId === null) throw new Error("Invoice did not return an ID.");

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/invoices/${invoiceId}`);
});
