import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function categoryIdentity(value: unknown): { id: number; version: number } | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;

  const { id, version } = value as { id?: unknown; version?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 && typeof version === "number"
    ? { id, version }
    : null;
}

test("product category management renames a server-tree category with its current version", async ({
  page,
}) => {
  const suffix = Date.now();
  const categoryName = `E2E Rename Category ${suffix}`;
  const renamedCategoryName = `E2E Renamed Category ${suffix}`;
  const categoryResponse = await page.request.post(`${baseUrl}/api/v1/product-categories`, {
    data: { name: categoryName },
    headers,
  });
  expect(categoryResponse.ok()).toBeTruthy();
  const category = categoryIdentity(await categoryResponse.json());
  expect(category).not.toBeNull();
  if (category === null) throw new Error("Category did not return an ID and version.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/products/categories`, { waitUntil: "networkidle" });

  const categoryNode = page
    .getByText(categoryName, { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'ant-tree-treenode')][1]");
  await expect(categoryNode).toBeVisible();
  await categoryNode.getByRole("button", { name: "编辑名称" }).click();
  const dialog = page.getByRole("dialog", { name: "编辑分类名称" });
  await dialog.getByLabel("分类名称").fill(renamedCategoryName);
  const updateRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/product-categories/${category.id}` &&
      request.method() === "PUT",
  );
  const categoryTreeResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/product-categories" &&
      response.request().method() === "GET" &&
      response.ok(),
  );
  await dialog.getByRole("button", { name: "保存名称" }).click();

  expect((await updateRequest).postDataJSON()).toEqual({
    name: renamedCategoryName,
    version: category.version,
  });
  await expect(dialog).toHaveCount(0);
  expect(JSON.stringify(await (await categoryTreeResponse).json())).toContain(renamedCategoryName);
});
