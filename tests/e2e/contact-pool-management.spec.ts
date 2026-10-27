import { expect, test } from "./support/contact-pool-test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("a management-authorized member opens the paged contact-pool configuration list", async ({
  page,
  contactPoolIdentity,
}) => {
  const name = `E2E Managed Pool ${Date.now()}`;
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

  await page.goto(`${baseUrl}/crm/contact-pools`, { waitUntil: "networkidle" });

  await page.getByRole("button", { exact: true, name: "管理公海配置" }).click();

  await expect(page).toHaveURL(new RegExp("/crm/contact-pools/manage$"));
  await expect(page.getByRole("heading", { exact: true, name: "联系人公海管理" })).toBeVisible();
  await expect(page.getByLabel("桌面列表").getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByLabel("桌面列表")).toContainText("日上限 10；原负责人冷却 7 天");
});
