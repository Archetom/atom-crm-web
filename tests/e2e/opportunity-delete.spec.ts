import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function opportunityIdentity(value: unknown): { id: number; version: number } | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;

  const { id, version } = value as { id?: unknown; version?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 && typeof version === "number"
    ? { id, version }
    : null;
}

test("opportunity detail explicitly soft-deletes an opportunity with its current version", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Opportunity Delete Customer ${suffix}`;
  const opportunityName = `E2E Delete Opportunity ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/opportunities/new`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "新建商机" })).toBeVisible();
  await page.getByLabel("商机名称").fill(opportunityName);
  await page.getByRole("button", { name: "选择客户" }).click();
  const customerDialog = page.getByRole("dialog", { name: "选择关联客户" });
  await customerDialog.getByPlaceholder("搜索可见客户").fill(customerName);
  await customerDialog.getByPlaceholder("搜索可见客户").press("Enter");
  await customerDialog.getByRole("button", { name: "选择" }).click();
  await expect(customerDialog).toBeHidden();

  const pipelineSelect = page.getByLabel("销售管线");
  await pipelineSelect.click();
  await pipelineSelect.press("ArrowDown");
  await pipelineSelect.press("Enter");
  await expect(page.getByLabel("销售阶段")).toBeEnabled();
  const stageSelect = page.getByLabel("销售阶段");
  await stageSelect.click();
  await stageSelect.press("ArrowDown");
  await stageSelect.press("Enter");
  await page.getByRole("button", { name: "创建商机" }).click();

  await expect(page).toHaveURL(/\/crm\/opportunities\/\d+$/);
  const opportunityId = Number(new URL(page.url()).pathname.split("/").at(-1));
  expect(Number.isSafeInteger(opportunityId)).toBeTruthy();
  const opportunityResponse = await page.request.get(
    `${baseUrl}/api/v1/opportunities/${opportunityId}`,
    {
      headers,
    },
  );
  expect(opportunityResponse.ok()).toBeTruthy();
  const opportunity = opportunityIdentity(await opportunityResponse.json());
  expect(opportunity).not.toBeNull();
  if (opportunity === null) throw new Error("Opportunity did not return an ID and version.");

  await expect(page.getByRole("heading", { name: opportunityName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "删除商机" }).click();
  const confirmation = page.getByRole("tooltip", { name: `删除商机“${opportunityName}”？` });
  await expect(confirmation).toBeVisible();
  const deleteRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/opportunities/${opportunity.id}` &&
      request.method() === "DELETE",
  );
  await confirmation.getByRole("button", { name: "确认删除" }).click();

  expect(new URL((await deleteRequest).url()).searchParams.get("version")).toBe(
    String(opportunity.version),
  );
  await expect(page).toHaveURL(`${baseUrl}/crm/opportunities`);
});
