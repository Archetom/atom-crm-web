import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const ownerHeaders = { "X-Dev-Tenant-Id": "900001", "X-Dev-User-Id": "900001" };

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function identifierFrom(value: unknown): number | null {
  const id = recordOf(value)?.id;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}
function versionFrom(value: unknown): number | null {
  const version = recordOf(value)?.version;
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0
    ? version
    : null;
}

test("an invoice owner assigns a visible active member with the current version", async ({
  page,
}) => {
  const suffix = Date.now();
  const assigneeActorId = 900041;
  const assigneeName = "E2E Invoice Owner";
  const assigneeHeaders = { "X-Dev-Tenant-Id": "900042", "X-Dev-User-Id": String(assigneeActorId) };
  expect(
    (
      await page.request.put(`${baseUrl}/api/v1/organization/profile`, {
        data: { displayName: assigneeName },
        headers: assigneeHeaders,
      })
    ).ok(),
  ).toBeTruthy();
  const membership = await page.request.post(`${baseUrl}/api/v1/organization/membership-requests`, {
    data: { targetTenantId: 900001 },
    headers: assigneeHeaders,
  });
  if (membership.ok()) {
    const requestId = identifierFrom(await membership.json());
    if (requestId === null) throw new Error("Membership request did not return an ID.");
    expect(
      (
        await page.request.post(
          `${baseUrl}/api/v1/organization/membership-requests/${requestId}/approve`,
          { headers: ownerHeaders },
        )
      ).ok(),
    ).toBeTruthy();
  } else expect(membership.status()).toBe(409);

  const customer = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Invoice Owner Customer ${suffix}` },
    headers: ownerHeaders,
  });
  const customerId = identifierFrom(await customer.json());
  if (!customer.ok() || customerId === null) throw new Error("Customer setup failed.");
  const product = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-IVO-P-${suffix}`,
      listPrice: 100,
      name: `E2E Invoice Owner Product ${suffix}`,
    },
    headers: ownerHeaders,
  });
  const productId = identifierFrom(await product.json());
  if (!product.ok() || productId === null) throw new Error("Product setup failed.");
  const contract = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Invoice Owner Contract ${suffix}`,
      number: `E2E-IVO-${suffix}`,
      products: [{ productId, quantity: 1 }],
    },
    headers: ownerHeaders,
  });
  const contractId = identifierFrom(await contract.json());
  if (!contract.ok() || contractId === null) throw new Error("Contract setup failed.");
  const invoiceResponse = await page.request.post(`${baseUrl}/api/v1/invoices`, {
    data: {
      amount: 12.34,
      contractId,
      invoiceType: "VAT",
      taxNumber: `TAX-O-${suffix}`,
      title: `E2E Invoice Owner Title ${suffix}`,
      titleType: "ORGANIZATION",
    },
    headers: ownerHeaders,
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
  await page.getByRole("button", { name: "变更负责人" }).click();
  const dialog = page.getByRole("dialog", { name: "变更负责人" });
  await dialog.getByPlaceholder("按成员姓名搜索").fill(assigneeName);
  await dialog.getByPlaceholder("按成员姓名搜索").press("Enter");
  const assigneeItem = dialog
    .getByRole("heading", { name: assigneeName, exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(assigneeItem).toBeVisible();
  const updateRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/invoices/${invoiceId}/owner` &&
      request.method() === "PUT",
  );
  await assigneeItem.getByRole("button", { name: "选择" }).click();
  expect((await updateRequest).postDataJSON()).toEqual({ ownerActorId: assigneeActorId, version });
  await expect(dialog).toBeHidden();
});
