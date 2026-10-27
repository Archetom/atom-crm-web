import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = { "X-Dev-Tenant-Id": "900001", "X-Dev-User-Id": "900001" };

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function identifierFrom(value: unknown): number | null {
  const identifier = recordOf(value)?.id;
  return typeof identifier === "number" && Number.isSafeInteger(identifier) && identifier > 0
    ? identifier
    : null;
}

function versionFrom(value: unknown): number | null {
  const version = recordOf(value)?.version;
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0
    ? version
    : null;
}

test("a pending invoice registers directly entered issue details with the current version", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Issue Invoice Customer ${suffix}` },
    headers,
  });
  const customerId = identifierFrom(await customerResponse.json());
  if (!customerResponse.ok() || customerId === null) throw new Error("Customer setup failed.");

  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-IIV-P-${suffix}`,
      listPrice: 100,
      name: `E2E Issue Invoice Product ${suffix}`,
    },
    headers,
  });
  const productId = identifierFrom(await productResponse.json());
  if (!productResponse.ok() || productId === null) throw new Error("Product setup failed.");

  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Issue Invoice Contract ${suffix}`,
      number: `E2E-IIV-${suffix}`,
      products: [{ productId, quantity: 1 }],
    },
    headers,
  });
  const contractId = identifierFrom(await contractResponse.json());
  if (!contractResponse.ok() || contractId === null) throw new Error("Contract setup failed.");

  const invoiceResponse = await page.request.post(`${baseUrl}/api/v1/invoices`, {
    data: {
      amount: 12.34,
      contractId,
      invoiceType: "VAT",
      taxNumber: `TAX-I-${suffix}`,
      title: `E2E Issue Invoice Title ${suffix}`,
      titleType: "ORGANIZATION",
    },
    headers,
  });
  const invoice = await invoiceResponse.json();
  const invoiceId = identifierFrom(invoice);
  const version = versionFrom(invoice);
  if (!invoiceResponse.ok() || invoiceId === null || version === null)
    throw new Error("Invoice setup failed.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/invoices/${invoiceId}`, {
    waitUntil: "networkidle",
  });

  await page.getByRole("button", { name: "登记开票结果", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "登记开票结果" });
  await dialog.getByLabel("发票号码").fill(`E2E-ISSUED-${suffix}`);
  await dialog.getByLabel("开票日期").fill("2026-07-26");
  await dialog.getByLabel("物流单号").fill(`LOG-I-${suffix}`);
  const issueRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/invoices/${invoiceId}/issue` &&
      request.method() === "PUT",
  );
  await dialog.getByRole("button", { name: "确认登记", exact: true }).click();

  expect((await issueRequest).postDataJSON()).toEqual({
    invoiceNumber: `E2E-ISSUED-${suffix}`,
    issuedDate: "2026-07-26",
    logisticsNumber: `LOG-I-${suffix}`,
    version,
  });
  await expect(dialog).toBeHidden();
  await expect(page.getByText("ISSUED", { exact: true })).toBeVisible();
});
