import { expect, test } from "./support/contact-pool-test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("a pool administrator explicitly deletes an empty contact pool with its current version", async ({
  page,
  contactPoolIdentity,
}) => {
  const poolName = `E2E Empty Pool ${Date.now()}`;
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
  await row.getByRole("button", { exact: true, name: "删除公海" }).click();
  await page.getByRole("button", { exact: true, name: "确认删除" }).click();

  await expect(row).toHaveCount(0);
});
