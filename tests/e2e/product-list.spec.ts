import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

test("product list posts its URL query and opens a server-created visible product", async ({
  page,
}) => {
  const suffix = Date.now();
  const productName = `E2E Product ${suffix}`;
  const productCode = `E2E-${suffix}`;
  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: productCode,
      listPrice: 10,
      name: productName,
      unit: "套",
    },
    headers,
  });
  expect(productResponse.ok()).toBeTruthy();

  let productRequest: { body: unknown; method: string; url: string } | null = null;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/products/query") {
      productRequest = {
        body: request.postDataJSON(),
        method: request.method(),
        url: request.url(),
      };
    }
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(
    `${baseUrl}/crm/products?page=1&size=50&keyword=${encodeURIComponent(productName)}`,
    { waitUntil: "networkidle" },
  );

  await expect(page.getByRole("heading", { name: "产品管理", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("搜索产品名称或编码")).toHaveValue(productName);
  await expect(page.getByLabel("桌面列表").getByText(productName, { exact: true })).toBeVisible();
  await expect(page.getByLabel("桌面列表").getByText(productCode, { exact: true })).toBeVisible();
  await expect.poll(() => productRequest?.url).toBe(`${baseUrl}/api/v1/products/query`);
  expect(productRequest?.method).toBe("POST");
  expect(productRequest?.body).toEqual({
    keyword: productName,
    page: 1,
    size: 50,
  });

  await page.getByRole("button", { name: productName, exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("productId")).toMatch(/^\d+$/);
  expect(new URL(page.url()).pathname).toBe("/crm/products");
  const productDetail = page.getByLabel("产品详情");
  await expect(
    productDetail.getByRole("heading", { name: productName, exact: true }),
  ).toBeVisible();
  await expect(productDetail.getByText(productCode, { exact: true })).toBeVisible();
  await expect(page.getByText("10", { exact: true })).toBeVisible();
});
