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

test("customer-context contract basics send only changed explicit fields through PATCH", async ({
  page,
}) => {
  const suffix = Date.now();
  const originalName = `E2E Contract Original ${suffix}`;
  const originalNumber = `E2E-CBE-${suffix}`;
  const updatedName = `E2E Contract Updated ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Contract Edit Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: { customerId, name: originalName, number: originalNumber, products: [] },
    headers,
  });
  expect(contractResponse.ok()).toBeTruthy();
  const contract = await contractResponse.json();
  const contractId = identifierFrom(contract);
  const version = versionFrom(contract);
  expect(contractId).not.toBeNull();
  expect(version).not.toBeNull();
  if (contractId === null || version === null)
    throw new Error("Contract did not return an ID and version.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/contracts/${contractId}`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "编辑基本信息" }).click();
  const dialog = page.getByRole("dialog", { name: "编辑合同基本信息" });
  await dialog.getByLabel("合同名称").fill(updatedName);
  const updateRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/contracts/${contractId}` &&
      request.method() === "PATCH",
  );
  await dialog.getByRole("button", { name: "保存修改" }).click();
  expect((await updateRequest).postDataJSON()).toEqual({ name: updatedName, version });
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: updatedName, exact: true })).toBeVisible();
});
