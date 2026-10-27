import { expect, test } from "./support/contact-pool-test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("a pool administrator updates the non-membership configuration with the current version", async ({
  page,
  contactPoolIdentity,
}) => {
  const name = `E2E Editable Pool ${Date.now()}`;
  const updatedName = `${name} Updated`;
  const response = await page.request.post(`${baseUrl}/api/v1/contact-pools`, {
    data: {
      name,
      administratorActorIds: [contactPoolIdentity.id],
      eligibleActorIds: [contactPoolIdentity.id],
      eligibleDepartmentIds: [],
      dailyClaimLimit: 10,
      previousOwnerCooldownDays: 7,
      automaticReleaseEnabled: false,
      rules: [],
    },
    headers: contactPoolIdentity.headers,
  });
  expect(response.ok()).toBeTruthy();

  await page.goto(`${baseUrl}/crm/contact-pools/manage`, { waitUntil: "networkidle" });

  const row = page.getByLabel("桌面列表").locator("tr").filter({ hasText: name });
  await row.getByRole("button", { exact: true, name: "编辑配置" }).click();
  const dialog = page.getByRole("dialog", { name: "编辑联系人公海配置" });
  await dialog.getByLabel("编辑联系人公海名称").fill(updatedName);
  await dialog.getByLabel("每日领取上限").fill("20");
  await dialog.getByRole("button", { exact: true, name: "添加未更新规则" }).click();
  await dialog.getByRole("switch", { name: "启用自动释放" }).click();
  await dialog.getByRole("button", { exact: true, name: "保存配置" }).click();

  await expect(dialog).toHaveCount(0);
  const updatedRow = page.getByLabel("桌面列表").locator("tr").filter({ hasText: updatedName });
  await expect(updatedRow).toContainText("日上限 20；原负责人冷却 7 天");
  await expect(updatedRow).toContainText("已启用");
});
