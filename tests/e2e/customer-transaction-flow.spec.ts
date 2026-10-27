import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = { "X-Dev-Tenant-Id": "900001", "X-Dev-User-Id": "900001" };

// This deliberately crosses three lazily loaded transaction routes in one browser session.
test.setTimeout(180_000);

function identifierFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const identifier = (value as { id?: unknown }).id;
  return typeof identifier === "number" && Number.isSafeInteger(identifier) && identifier > 0
    ? identifier
    : null;
}

test("customer transaction flow creates a contract, invoice, and receivable through the UI", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Transaction Customer ${suffix}` },
    headers,
  });
  const customerId = identifierFrom(await customerResponse.json());
  if (!customerResponse.ok() || customerId === null) throw new Error("Customer setup failed.");

  const productName = `E2E Transaction Product ${suffix}`;
  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-TX-P-${suffix}`,
      listPrice: 100,
      name: productName,
    },
    headers,
  });
  const productId = identifierFrom(await productResponse.json());
  if (!productResponse.ok() || productId === null) throw new Error("Product setup failed.");

  const contractName = `E2E Transaction Contract ${suffix}`;
  const contractNumber = `E2E-TX-${suffix}`;
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });

  await page.goto(`${baseUrl}/crm/customers/${customerId}/contracts`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建合同", exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/contracts/new`);

  await page.getByRole("button", { name: "选择产品", exact: true }).click();
  const productDialog = page.getByRole("dialog", { name: "选择合同产品" });
  const productQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/products/query" &&
      request.method() === "POST" &&
      request.postData()?.includes(productName) === true,
  );
  await productDialog.getByPlaceholder("按产品名称或编码搜索").fill(productName);
  expect((await productQuery).postDataJSON()).toEqual({ keyword: productName, page: 1, size: 50 });
  const productItem = productDialog
    .getByText(productName, { exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(productItem).toBeVisible();
  await productItem.getByRole("button", { name: "选择", exact: true }).click();

  await page.getByLabel("合同名称").fill(contractName);
  await page.getByLabel("合同编号").fill(contractNumber);
  const contractCreate = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contracts" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建合同", exact: true }).click();
  const contractCreateRequest = await contractCreate;
  expect(contractCreateRequest.postDataJSON()).toEqual({
    customerId,
    discountRate: 0,
    name: contractName,
    number: contractNumber,
    products: [{ productId, quantity: 1 }],
  });
  const contractResponse = await contractCreateRequest.response();
  const contractId = identifierFrom(await contractResponse?.json());
  if (!contractResponse?.ok() || contractId === null) throw new Error("Contract creation failed.");
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/contracts/${contractId}`);

  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建发票", exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/invoices/new`);
  const invoiceContractQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contracts/query" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "选择合同", exact: true }).click();
  expect((await invoiceContractQuery).postDataJSON()).toEqual({ customerId, page: 1, size: 50 });
  const invoiceContractDialog = page.getByRole("dialog", { name: "选择关联合同" });
  await expect(invoiceContractDialog.getByText(contractNumber, { exact: false })).toBeVisible();
  await invoiceContractDialog.getByRole("button", { name: /选\s*择/ }).click();

  const invoiceTitle = `E2E Transaction Invoice ${suffix}`;
  await page.getByLabel("发票金额").fill("12.34");
  await page.getByLabel("申请日期").fill("2026-07-26");
  await page.getByLabel("发票类型").fill("VAT");
  await page.getByLabel("开票抬头").fill(invoiceTitle);
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
    requestedDate: "2026-07-26",
    title: invoiceTitle,
    titleType: "INDIVIDUAL",
  });
  const invoiceResponse = await invoiceCreateRequest.response();
  const invoiceId = identifierFrom(await invoiceResponse?.json());
  if (!invoiceResponse?.ok() || invoiceId === null) throw new Error("Invoice creation failed.");
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/invoices/${invoiceId}`);

  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建回款", exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/receivables/new`);
  const receivableContractQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contracts/query" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "选择合同", exact: true }).click();
  expect((await receivableContractQuery).postDataJSON()).toEqual({
    customerId,
    page: 1,
    size: 50,
  });
  const receivableContractDialog = page.getByRole("dialog", { name: "选择关联合同" });
  await expect(receivableContractDialog.getByText(contractNumber, { exact: false })).toBeVisible();
  await receivableContractDialog.getByRole("button", { name: /选\s*择/ }).click();

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
  const receivableId = identifierFrom(await receivableResponse?.json());
  if (!receivableResponse?.ok() || receivableId === null) {
    throw new Error("Receivable creation failed.");
  }
  await expect(page).toHaveURL(
    `${baseUrl}/crm/customers/${customerId}/receivables/${receivableId}`,
  );
});
