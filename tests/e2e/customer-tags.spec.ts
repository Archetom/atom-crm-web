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

test("customer detail replaces tags after the server confirms an unmasked tag catalog", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Tagged Customer ${suffix}`;
  const tag = `重点客户 ${suffix}`;
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
  await page.getByRole("tab", { name: "详细资料", exact: true }).click();
  await page.getByRole("button", { name: "管理标签" }).click();
  const dialog = page.getByRole("dialog", { name: "管理客户标签" });
  const tagInput = dialog.getByLabel("客户标签");
  await expect(dialog).toBeVisible();
  await expect(tagInput).toBeEnabled();
  await tagInput.fill(tag);
  await tagInput.press("Enter");
  await tagInput.press("Escape");
  await expect(tagInput).toHaveAttribute("aria-expanded", "false");

  const saveButton = dialog.getByRole("button", { name: "保存标签" });
  await expect(saveButton).toBeEnabled();
  const replaceRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/customers/${customer.id}/tags` &&
      request.method() === "PUT",
  );
  await saveButton.click();

  expect((await replaceRequest).postDataJSON()).toEqual({ tags: [tag], version: customer.version });
  await expect(dialog).toBeHidden();
  await expect(page.getByText(tag, { exact: true })).toBeVisible();
});
