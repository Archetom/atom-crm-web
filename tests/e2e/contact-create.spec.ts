import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("contact creation redirects to the server-returned detail record", async ({ page }) => {
  const name = `E2E Web Contact ${Date.now()}`;
  const description = "E2E 更新后的联系人说明";
  const customerName = `${name} Customer`;
  const parentName = `${name} Parent`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers: {
      "X-Dev-Tenant-Id": "900001",
      "X-Dev-User-Id": "900001",
    },
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerPayload: unknown = await customerResponse.json();
  const customerId =
    customerPayload !== null &&
    typeof customerPayload === "object" &&
    typeof (customerPayload as { id?: unknown }).id === "number"
      ? (customerPayload as { id: number }).id
      : null;
  expect(customerId).not.toBeNull();
  const parentResponse = await page.request.post(`${baseUrl}/api/v1/contacts`, {
    data: { name: parentName },
    headers: {
      "X-Dev-Tenant-Id": "900001",
      "X-Dev-User-Id": "900001",
    },
  });
  expect(parentResponse.ok()).toBeTruthy();
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });

  await page.goto(`${baseUrl}/crm/contacts/new`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "新建联系人" })).toBeVisible();

  await page.getByPlaceholder("请输入联系人姓名").fill(name);
  await page.getByPlaceholder("请输入职务").fill("采购经理");
  await page.getByPlaceholder("例如 +8613812345678").fill("+8613812345678");
  await page.getByRole("button", { name: "创建联系人" }).click();

  await expect(page).toHaveURL(/\/crm\/contacts\/\d+$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("采购经理", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "编辑基础信息" }).click();
  await expect(page.getByRole("heading", { name: "编辑联系人" })).toBeVisible();
  await page.locator("textarea").fill(description);
  await page.getByRole("button", { name: "保存修改" }).click();

  await expect(page).toHaveURL(/\/crm\/contacts\/\d+$/);
  await expect(page.getByText(description)).toBeVisible();

  await page.getByRole("button", { name: "关注" }).click();
  await expect(page.getByRole("button", { name: "取消关注" })).toBeVisible();
  await page.getByRole("button", { name: "取消关注" }).click();
  await expect(page.getByRole("button", { name: "关注" })).toBeVisible();

  await page.getByRole("button", { name: "关联客户" }).click();
  const customerDialog = page.getByRole("dialog", { name: "关联客户" });
  await expect(customerDialog).toBeVisible();
  const customerSearch = customerDialog.getByPlaceholder("搜索可见客户");
  await customerSearch.fill(customerName);
  await customerSearch.press("Enter");
  await customerDialog.getByRole("button", { name: "关联" }).click();
  await expect(customerDialog).toBeHidden();
  await expect(page.getByText(String(customerId), { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "设置上级联系人" }).click();
  const parentDialog = page.getByRole("dialog", { name: "设置上级联系人" });
  await expect(parentDialog).toBeVisible();
  const parentSearch = parentDialog.getByPlaceholder("搜索可见联系人");
  await parentSearch.fill(parentName);
  await parentSearch.press("Enter");
  await parentDialog.getByRole("button", { name: "设为上级" }).click();
  await expect(parentDialog).toBeHidden();
  await expect(page.getByText(`上级联系人：${parentName}`, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "变更负责人" }).click();
  const ownerDialog = page.getByRole("dialog", { name: "变更负责人" });
  await expect(ownerDialog).toBeVisible();
  await expect(ownerDialog.getByPlaceholder("按成员姓名搜索")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ownerDialog).toBeHidden();

  await page.getByRole("button", { name: "管理协作者" }).click();
  const collaboratorDialog = page.getByRole("dialog", { name: "管理协作者" });
  await expect(collaboratorDialog).toBeVisible();
  await expect(
    collaboratorDialog.getByText(
      "协作者清单由服务端完整替换。读取异常时不会允许保存；最终成员范围与读写权限仍由服务端校验。",
    ),
  ).toBeVisible();
  await expect(collaboratorDialog.getByRole("button", { name: "保存协作者" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(collaboratorDialog).toBeHidden();

  await page.goto(`${baseUrl}/crm/contacts/new`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("请输入联系人姓名").fill(name);
  await page.getByRole("button", { name: "检查重复" }).click();
  await expect(page.getByText("发现当前可见范围内存在重复联系人，请核对后再创建。")).toBeVisible();
});

test("contact creation sends only explicitly entered tags", async ({ page }) => {
  const suffix = Date.now();
  const name = `E2E Contact Tags ${suffix}`;
  const tag = `重点联系人${suffix}`;
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/contacts/new`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("请输入联系人姓名").fill(name);
  await page.getByLabel("联系人标签").fill(tag);
  await page.getByLabel("联系人标签").press("Enter");

  const contactRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contacts" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建联系人" }).click();

  expect((await contactRequest).postDataJSON()).toMatchObject({ name, tags: [tag] });
  await expect(page).toHaveURL(/\/crm\/contacts\/\d+$/);
});
