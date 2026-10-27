import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function customerIdentity(value: unknown): { id: number; version: number } | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;

  const { id, version } = value as { id?: unknown; version?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 && typeof version === "number"
    ? { id, version }
    : null;
}

test("customer detail explicitly soft-deletes a customer with its current version", async ({
  page,
}) => {
  const customerName = `E2E Delete Customer ${Date.now()}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customer = customerIdentity(await customerResponse.json());
  expect(customer).not.toBeNull();
  if (customer === null) throw new Error("Customer did not return an ID and version.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customer.id}`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: customerName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "删除客户" }).click();
  const confirmation = page.getByRole("tooltip", { name: `删除客户“${customerName}”？` });
  await expect(confirmation).toBeVisible();
  const deleteRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/customers/${customer.id}` &&
      request.method() === "DELETE",
  );
  await confirmation.getByRole("button", { name: "确认删除" }).click();

  expect(new URL((await deleteRequest).url()).searchParams.get("version")).toBe(
    String(customer.version),
  );
  await expect(page).toHaveURL(`${baseUrl}/crm/customers`);
});
