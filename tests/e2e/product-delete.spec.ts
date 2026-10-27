import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function productIdentity(value: unknown): { id: number; version: number } | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;

  const { id, version } = value as { id?: unknown; version?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 && typeof version === "number"
    ? { id, version }
    : null;
}

test("product detail explicitly soft-deletes a product with its current version", async ({
  page,
}) => {
  const suffix = Date.now();
  const productName = `E2E Delete Product ${suffix}`;
  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-DELETE-${suffix}`,
      listPrice: 10,
      name: productName,
    },
    headers,
  });
  expect(productResponse.ok()).toBeTruthy();
  const product = productIdentity(await productResponse.json());
  expect(product).not.toBeNull();
  if (product === null) throw new Error("Product did not return an ID and version.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/products/${product.id}`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: productName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "删除产品" }).click();
  const confirmation = page.getByRole("tooltip", { name: `删除产品“${productName}”？` });
  await expect(confirmation).toBeVisible();
  const deleteRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/products/${product.id}` &&
      request.method() === "DELETE",
  );
  await confirmation.getByRole("button", { name: "确认删除" }).click();

  expect(new URL((await deleteRequest).url()).searchParams.get("version")).toBe(
    String(product.version),
  );
  await expect(page).toHaveURL(`${baseUrl}/crm/products`);
});
