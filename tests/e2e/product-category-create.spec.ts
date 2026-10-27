import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("product category management creates root and server-tree child categories", async ({
  page,
}) => {
  const suffix = Date.now();
  const categoryName = `E2E Root Category ${suffix}`;
  const childCategoryName = `E2E Child Category ${suffix}`;

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/products/categories`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "产品分类管理" })).toBeVisible();
  await page.getByRole("button", { name: "新建根分类" }).click();
  const dialog = page.getByRole("dialog", { name: "新建根分类" });
  await dialog.getByLabel("分类名称").fill(categoryName);
  await dialog.getByRole("button", { name: "创建分类" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(categoryName, { exact: true })).toBeVisible();

  const rootNode = page
    .getByText(categoryName, { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'ant-tree-treenode')][1]");
  await rootNode.getByRole("button", { name: "新建子分类" }).click();
  const childDialog = page.getByRole("dialog", { name: "新建子分类" });
  await childDialog.getByLabel("分类名称").fill(childCategoryName);
  const childRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/product-categories" &&
      request.method() === "POST",
  );
  const childTreeResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/product-categories" &&
      response.request().method() === "GET" &&
      response.ok(),
  );
  await childDialog.getByRole("button", { name: "创建分类" }).click();

  expect((await childRequest).postDataJSON()).toEqual({
    name: childCategoryName,
    parentCategoryId: expect.any(Number),
  });
  await expect(childDialog).toHaveCount(0);
  expect(JSON.stringify(await (await childTreeResponse).json())).toContain(childCategoryName);
});
