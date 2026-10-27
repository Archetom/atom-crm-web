import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = { "X-Dev-Tenant-Id": "900001", "X-Dev-User-Id": "900001" };

function identifierFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const identifier = (value as { id?: unknown }).id;
  return typeof identifier === "number" && Number.isSafeInteger(identifier) && identifier > 0
    ? identifier
    : null;
}

function versionFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const version = (value as { version?: unknown }).version;
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0
    ? version
    : null;
}

test("customer-context receivable date sends only the explicit field through PATCH", async ({
  page,
}) => {
  const suffix = Date.now();
  const updatedReceivedDate = "2026-08-26";
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Receivable Edit Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-RDE-P-${suffix}`,
      listPrice: 100,
      name: `E2E Receivable Edit Product ${suffix}`,
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
      name: `E2E Receivable Edit Contract ${suffix}`,
      number: `E2E-RDE-${suffix}`,
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
  const version = versionFrom(receivable);
  expect(receivableId).not.toBeNull();
  expect(version).not.toBeNull();
  if (receivableId === null || version === null)
    throw new Error("Receivable did not return an ID and version.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/receivables/${receivableId}`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "编辑回款日期" }).click();
  const dialog = page.getByRole("dialog", { name: "编辑回款日期" });
  await dialog.getByLabel("回款日期").fill(updatedReceivedDate);
  const updateRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/receivables/${receivableId}` &&
      request.method() === "PATCH",
  );
  await dialog.getByRole("button", { name: "保存修改" }).click();

  expect((await updateRequest).postDataJSON()).toEqual({
    receivedDate: updatedReceivedDate,
    version,
  });
  await expect(dialog).toBeHidden();
  await expect(page.getByText(updatedReceivedDate, { exact: true })).toBeVisible();
});
