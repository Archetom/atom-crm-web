import { expect, test } from "./support/contact-pool-test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("a pool administrator adds a server-visible department to the eligibility range", async ({
  page,
  contactPoolIdentity,
}) => {
  const suffix = Date.now();
  const departmentName = `E2E Eligibility Department ${suffix}`;
  const departmentResponse = await page.request.post(`${baseUrl}/api/v1/organization/departments`, {
    data: { name: departmentName },
    headers: contactPoolIdentity.headers,
  });
  expect(departmentResponse.ok()).toBeTruthy();

  const poolName = `E2E Eligibility Pool ${suffix}`;
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
  const departmentItem = dialog.getByRole("listitem").filter({ hasText: departmentName });
  await departmentItem.getByRole("button", { exact: true, name: "添加部门范围" }).click();
  await dialog.getByRole("button", { exact: true, name: "保存配置" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText("成员 1 / 部门 1");
});
