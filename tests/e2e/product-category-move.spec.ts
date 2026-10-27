import { expect, test, type APIRequestContext } from "@playwright/test";

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

async function createCategory(request: APIRequestContext, name: string, parentCategoryId?: number) {
  const response = await request.post(`${baseUrl}/api/v1/product-categories`, {
    data: { name, ...(parentCategoryId === undefined ? {} : { parentCategoryId }) },
    headers,
  });
  expect(response.ok()).toBeTruthy();
  const category = categoryIdentity(await response.json());
  expect(category).not.toBeNull();
  if (category === null) throw new Error("Category did not return an ID and version.");
  return category;
}

test("product category management moves a category beneath a server-tree parent", async ({
  page,
}) => {
  const suffix = Date.now();
  const sourceCategoryName = `E2E Move Source ${suffix}`;
  const destinationCategoryName = `E2E Move Destination ${suffix}`;
  const sourceCategory = await createCategory(page.request, sourceCategoryName);
  const destinationCategory = await createCategory(page.request, destinationCategoryName);

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/products/categories`, { waitUntil: "networkidle" });

  const categoryNode = page
    .getByText(sourceCategoryName, { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'ant-tree-treenode')][1]");
  await expect(categoryNode).toBeVisible();
  await categoryNode.getByRole("button", { name: "移动分类" }).click();
  const dialog = page.getByRole("dialog", { name: "移动分类" });
  await dialog.getByLabel("目标父级").fill(destinationCategoryName);
  await dialog.getByLabel("目标父级").press("Enter");
  const moveResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/product-categories/${sourceCategory.id}` &&
      response.request().method() === "PUT" &&
      response.ok(),
  );
  await dialog.getByRole("button", { name: "确认移动" }).click();

  expect((await moveResponse).request().postDataJSON()).toEqual({
    name: sourceCategoryName,
    parentCategoryId: destinationCategory.id,
    version: sourceCategory.version,
  });
  await expect(dialog).toHaveCount(0);
});
