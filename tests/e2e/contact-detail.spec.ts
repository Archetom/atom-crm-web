import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("contact detail reads a server-created visible contact", async ({ page }) => {
  const name = `E2E Web Contact ${Date.now()}`;
  const response = await page.request.post(`${baseUrl}/api/v1/contacts`, {
    data: { jobTitle: "采购经理", name },
    headers: {
      "X-Dev-Tenant-Id": "900001",
      "X-Dev-User-Id": "900001",
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload: unknown = await response.json();
  const contactId =
    payload !== null &&
    typeof payload === "object" &&
    typeof (payload as { id?: unknown }).id === "number"
      ? (payload as { id: number }).id
      : null;
  expect(contactId).not.toBeNull();

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/contacts/${contactId}`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { exact: true, name })).toBeVisible();
  await expect(page.getByText("采购经理", { exact: true })).toBeVisible();
  await expect(page.getByText("基本信息", { exact: true })).toBeVisible();
});
