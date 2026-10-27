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

test("customer detail enters money-free server-scoped receivable-plan list and detail without a navigation entry", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Receivable Plan Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-RP-P-${suffix}`,
      listPrice: 100,
      name: `E2E Receivable Plan Product ${suffix}`,
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
      name: `E2E Receivable Plan Contract ${suffix}`,
      number: `E2E-RP-${suffix}`,
      products: [{ productId, quantity: 1 }],
    },
    headers,
  });
  expect(contractResponse.ok()).toBeTruthy();
  const contractId = identifierFrom(await contractResponse.json());
  expect(contractId).not.toBeNull();
  if (contractId === null) throw new Error("Contract did not return an ID.");

  const planResponse = await page.request.post(`${baseUrl}/api/v1/receivable-plans`, {
    data: {
      contractId,
      dueDate: "2026-08-26",
      paymentMethod: "TRANSFER",
      plannedAmount: 12.34,
    },
    headers,
  });
  expect(planResponse.ok()).toBeTruthy();
  const plan = await planResponse.json();
  const planId = identifierFrom(plan);
  expect(planId).not.toBeNull();
  if (planId === null) throw new Error("Receivable plan did not return an ID.");
  const planVersion = versionFrom(plan);
  expect(planVersion).not.toBeNull();
  if (planVersion === null) throw new Error("Receivable plan did not return a version.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  const planQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/receivable-plans/query" &&
      request.method() === "POST",
  );
  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "查看回款计划" }).click();

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/receivable-plans`);
  await expect(page.getByRole("heading", { name: "客户回款计划", exact: true })).toBeVisible();
  await expect(page.getByLabel("桌面列表").getByText("ACTIVE", { exact: true })).toBeVisible();
  expect((await planQuery).postDataJSON()).toEqual({ customerId, page: 1, size: 15 });

  const detailRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/receivable-plans/${planId}` &&
      request.method() === "GET",
  );
  await page
    .getByLabel("桌面列表")
    .getByRole("link", { name: /第 \d+ 期/ })
    .click();
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/receivable-plans/${planId}`);
  await expect(page.getByRole("heading", { name: /第 \d+ 期/ })).toBeVisible();
  await detailRequest;

  const deletion = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/receivable-plans/${planId}` &&
      request.method() === "DELETE",
  );
  await page.getByRole("button", { name: "删除回款计划", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();

  expect(new URL((await deletion).url()).searchParams.get("version")).toBe(String(planVersion));
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/receivable-plans`);
});

test("customer detail creates a receivable plan from a server-visible contract", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Create Receivable Plan Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-CRP-P-${suffix}`,
      listPrice: 100,
      name: `E2E Create Receivable Plan Product ${suffix}`,
    },
    headers,
  });
  expect(productResponse.ok()).toBeTruthy();
  const productId = identifierFrom(await productResponse.json());
  expect(productId).not.toBeNull();
  if (productId === null) throw new Error("Product did not return an ID.");

  const contractNumber = `E2E-CRP-${suffix}`;
  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Create Receivable Plan Contract ${suffix}`,
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
  await page.getByRole("button", { name: "新建回款计划", exact: true }).click();

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/receivable-plans/new`);
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

  await page.getByLabel("到期日期").fill("2026-08-26");
  await page.getByLabel("计划金额").fill("12.34");
  await page.getByLabel("收款方式").fill("TRANSFER");
  const planCreate = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/receivable-plans" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建回款计划", exact: true }).click();

  const planCreateRequest = await planCreate;
  expect(planCreateRequest.postDataJSON()).toEqual({
    contractId,
    dueDate: "2026-08-26",
    paymentMethod: "TRANSFER",
    plannedAmount: 12.34,
  });
  const planResponse = await planCreateRequest.response();
  expect(planResponse?.ok()).toBeTruthy();
  const planId = identifierFrom(await planResponse?.json());
  expect(planId).not.toBeNull();
  if (planId === null) throw new Error("Receivable plan did not return an ID.");

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/receivable-plans/${planId}`);
});
