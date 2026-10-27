import { expect, test } from "./support/contact-pool-test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("a pool administrator deactivates an empty contact pool with its current version", async ({
  page,
  contactPoolIdentity,
}) => {
  const name = `E2E Status Pool ${Date.now()}`;
  const response = await page.request.post(`${baseUrl}/api/v1/contact-pools`, {
    data: {
      name,
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
  expect(response.ok()).toBeTruthy();

  await page.goto(`${baseUrl}/crm/contact-pools/manage`, { waitUntil: "networkidle" });

  const row = page.getByLabel("桌面列表").locator("tr").filter({ hasText: name });
  await expect(row).toContainText("启用");
  await row.getByRole("button", { exact: true, name: "停用公海" }).click();
  await page.getByRole("button", { exact: true, name: "确认停用" }).click();

  await expect(row).toContainText("停用");
  await expect(row.getByRole("button", { name: "启用公海" })).toBeEnabled();
});
