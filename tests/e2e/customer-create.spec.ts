import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("customer creation redirects to the server-returned detail record", async ({ page }) => {
  const name = `E2E Web Customer ${Date.now()}`;
  const parentName = `${name} Parent`;
  const description = "E2E 更新后的客户说明";
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });

  await page.goto(`${baseUrl}/crm/customers/new`, { waitUntil: "networkidle" });
  await expect(page.getByRole("dialog", { name: "新建客户" })).toBeVisible();

  await page.getByPlaceholder("请输入客户名称").fill(parentName);
  await page.getByRole("button", { name: "创建客户" }).click();
  await expect(page).toHaveURL(/\/crm\/customers\/\d+$/);

  await page.goto(`${baseUrl}/crm/customers/new`, { waitUntil: "networkidle" });
  await expect(page.getByRole("dialog", { name: "新建客户" })).toBeVisible();

  await page.getByPlaceholder("请输入客户名称").fill(name);
  await page.getByPlaceholder("例如 +8613812345678").fill("+8613812345678");
  await page.getByRole("button", { name: "创建客户" }).click();

  await expect(page).toHaveURL(/\/crm\/customers\/\d+$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("业务概览")).toBeVisible();
  await page.getByRole("button", { name: "变更负责人" }).click();
  const ownerDialog = page.getByRole("dialog", { name: "变更负责人" });
  await expect(ownerDialog).toBeVisible();
  await expect(ownerDialog.getByRole("button", { name: "当前负责人" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "管理协作者" }).click();
  const collaboratorDialog = page.getByRole("dialog", { name: "管理协作者" });
  await expect(collaboratorDialog).toBeVisible();
  await expect(collaboratorDialog.getByText("暂无协作者")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "详细资料", exact: true }).click();
  await expect(page.getByText("客户层级")).toBeVisible();
  await page.getByRole("button", { name: "设置上级客户" }).click();
  const parentDialog = page.getByRole("dialog", { name: "设置上级客户" });
  await expect(parentDialog).toBeVisible();
  const parentSearch = parentDialog.getByPlaceholder("搜索可见客户");
  await expect(parentSearch).toBeVisible();
  await parentSearch.fill(parentName);
  await parentSearch.press("Enter");
  await parentDialog.getByRole("button", { name: "设为上级" }).click();
  await expect(parentDialog).toBeHidden();
  await expect(page.getByText(`上级客户：${parentName}`)).toBeVisible();
  await page.getByRole("button", { name: "设置上级客户" }).click();
  await parentDialog.getByRole("button", { name: /清除当前上级/ }).click();
  await page
    .getByRole("tooltip")
    .getByRole("button", { name: /^清\s*除$/ })
    .click();
  await expect(parentDialog).toBeHidden();
  await page.getByRole("button", { name: "修改状态" }).click();
  const stateDialog = page.getByRole("dialog", { name: "修改客户状态" });
  const dealStatusSelect = stateDialog.getByLabel("成交状态");
  await dealStatusSelect.click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await stateDialog.getByRole("button", { name: "保存状态" }).click();
  await expect(stateDialog).toBeHidden();
  await expect(page.getByText("WON", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "修改状态" }).click();
  await dealStatusSelect.click();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await stateDialog.getByRole("button", { name: "保存状态" }).click();
  await expect(stateDialog).toBeHidden();

  await page.getByRole("button", { name: "编辑基础信息" }).click();
  await expect(page.getByRole("dialog", { name: "编辑客户" })).toBeVisible();
  await page.locator("textarea").fill(description);
  await page.getByRole("button", { name: "保存修改" }).click();

  await expect(page).toHaveURL(/\/crm\/customers\/\d+$/);
  await page.getByRole("tab", { name: "详细资料", exact: true }).click();
  await expect(page.getByText(description)).toBeVisible();

  await page.getByRole("button", { name: "关注" }).click();
  await expect(page.getByRole("button", { name: "取消关注" })).toBeVisible();
  await page.getByRole("button", { name: "取消关注" }).click();
  await expect(page.getByRole("button", { name: "关注" })).toBeVisible();

  await page.goto(`${baseUrl}/crm/customers?keyword=${encodeURIComponent(name)}`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "导出 CSV" }).click();
  const exportDialog = page.getByRole("dialog", { name: "导出客户 CSV" });
  await expect(exportDialog.getByText("首期固定导出“客户名称”列")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "导出 CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("customers.csv");

  await page.goto(`${baseUrl}/crm/customers/new`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("请输入客户名称").fill(name);
  await page.getByRole("button", { name: "检查重复" }).click();
  await expect(page.getByText("发现当前可见范围内存在重复客户，请核对后再创建。")).toBeVisible();
});

test("customer creation sends only explicitly entered tags", async ({ page }) => {
  const suffix = Date.now();
  const name = `E2E Customer Tags ${suffix}`;
  const tag = `重点客户${suffix}`;
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/new`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("请输入客户名称").fill(name);
  await page.getByLabel("客户标签").fill(tag);
  await page.getByLabel("客户标签").press("Enter");

  const customerRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/customers" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建客户" }).click();

  expect((await customerRequest).postDataJSON()).toMatchObject({ name, tags: [tag] });
  await expect(page).toHaveURL(/\/crm\/customers\/\d+$/);
});

test("customer creation sends only a server-confirmed parent customer", async ({ page }) => {
  const suffix = Date.now();
  const parentName = `E2E Parent Customer ${suffix}`;
  const name = `E2E Child Customer ${suffix}`;
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/new`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("请输入客户名称").fill(parentName);
  await page.getByRole("button", { name: "创建客户" }).click();
  await expect(page).toHaveURL(/\/crm\/customers\/\d+$/);
  const parentCustomerId = Number(new URL(page.url()).pathname.split("/").at(-1));
  expect(Number.isSafeInteger(parentCustomerId)).toBe(true);

  await page.goto(`${baseUrl}/crm/customers/new`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "选择上级客户" }).click();
  const parentDialog = page.getByRole("dialog", { name: "选择上级客户" });
  const parentSearch = parentDialog.getByPlaceholder("搜索可见客户");
  await parentSearch.fill(parentName);
  await expect(parentDialog.getByText(parentName, { exact: true })).toBeVisible();
  await parentDialog.getByRole("button", { name: "选择上级客户" }).click();
  await expect(parentDialog).toBeHidden();
  await expect(page.getByText(`将设置上级客户：${parentName}`)).toBeVisible();

  await page.getByPlaceholder("请输入客户名称").fill(name);
  const customerRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/customers" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建客户" }).click();

  expect((await customerRequest).postDataJSON()).toMatchObject({ name, parentCustomerId });
  await expect(page).toHaveURL(/\/crm\/customers\/\d+$/);
});

test("customer creation sends one explicit primary address", async ({ page }) => {
  const suffix = Date.now();
  const name = `E2E Customer Address ${suffix}`;
  const addressLine = `测试路 ${suffix} 号`;
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/new`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("请输入客户名称").fill(name);
  await page.getByLabel("详细地址").fill(addressLine);
  await page.getByLabel("地区").fill("上海市");
  await page.getByLabel("城市").fill("上海");
  await page.getByLabel("邮编").fill("200030");

  const customerRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/customers" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建客户" }).click();

  expect((await customerRequest).postDataJSON()).toMatchObject({
    name,
    addresses: [
      { addressLine, region: "上海市", city: "上海", postalCode: "200030", primary: true },
    ],
  });
  await expect(page).toHaveURL(/\/crm\/customers\/\d+$/);
});
