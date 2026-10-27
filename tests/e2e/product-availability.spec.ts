import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

test("product detail changes availability with the latest server version", async ({ page }) => {
  const suffix = Date.now();
  const productName = `E2E Availability Product ${suffix}`;
  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-AVAILABILITY-${suffix}`,
      listPrice: 10,
      name: productName,
    },
    headers,
  });
  expect(productResponse.ok()).toBeTruthy();
  const product = (await productResponse.json()) as { id: number };

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/products/${product.id}`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: productName, exact: true })).toBeVisible();
  await expect(page.getByText("AVAILABLE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下架产品" }).click();
  const dialog = page.getByRole("dialog", { name: "下架产品" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "确认下架" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("UNAVAILABLE", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "上架产品" })).toBeVisible();
});
