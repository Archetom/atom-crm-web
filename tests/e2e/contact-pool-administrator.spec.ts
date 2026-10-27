import { expect, test } from "./support/contact-pool-test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("a pool administrator can edit the administrator range from the server-visible directory", async ({
  page,
  contactPoolIdentity,
}) => {
  const poolName = `E2E Administrator Pool ${Date.now()}`;
  const poolResponse = await page.request.post(`${baseUrl}/api/v1/contact-pools`, {
    data: {
      name: poolName,
      administratorActorIds: [contactPoolIdentity.id],
      eligibleActorIds: [contactPoolIdentity.id],
      eligibleDepartmentIds: [],
      dailyClaimLimit: 0,
      previousOwnerCooldownDays: 0,
      automaticReleaseEnabled: false,
      rules: [],
    },
    headers: contactPoolIdentity.headers,
  });
  expect(poolResponse.ok()).toBeTruthy();

  await page.goto(`${baseUrl}/crm/contact-pools/manage`, { waitUntil: "networkidle" });

  const row = page.getByLabel("桌面列表").locator("tr").filter({ hasText: poolName });
  await row.getByRole("button", { exact: true, name: "编辑配置" }).click();
  const dialog = page.getByRole("dialog", { name: "编辑联系人公海配置" });
  await dialog
    .getByRole("button", { exact: true, name: `移除管理员 ${contactPoolIdentity.id}` })
    .click();
  await dialog
    .getByRole("listitem")
    .filter({ hasText: "E2E Tenant Owner" })
    .getByRole("button", { exact: true, name: "设为管理员" })
    .click();
  await dialog.getByRole("button", { exact: true, name: "保存配置" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText(`成员 ${contactPoolIdentity.id}`);
});
