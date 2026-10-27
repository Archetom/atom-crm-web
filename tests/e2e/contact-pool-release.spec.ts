import { expect, test } from "./support/contact-pool-test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("contact detail releases an active visible contact into an accessible pool", async ({
  page,
  contactPoolIdentity,
}) => {
  const poolName = `E2E Release Pool ${Date.now()}`;
  const contactName = `${poolName} Contact`;
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
  const poolPayload: unknown = await poolResponse.json();
  const poolId =
    poolPayload !== null &&
    typeof poolPayload === "object" &&
    typeof (poolPayload as { id?: unknown }).id === "number"
      ? (poolPayload as { id: number }).id
      : null;
  expect(poolId).not.toBeNull();
  if (poolId === null) throw new Error("Contact pool creation did not return an ID.");

  const contactResponse = await page.request.post(`${baseUrl}/api/v1/contacts`, {
    data: { name: contactName },
    headers: contactPoolIdentity.headers,
  });
  expect(contactResponse.ok()).toBeTruthy();
  const contactPayload: unknown = await contactResponse.json();
  const contactId =
    contactPayload !== null &&
    typeof contactPayload === "object" &&
    typeof (contactPayload as { id?: unknown }).id === "number"
      ? (contactPayload as { id: number }).id
      : null;
  expect(contactId).not.toBeNull();
  if (contactId === null) throw new Error("Contact creation did not return an ID.");

  await page.goto(`${baseUrl}/crm/contacts/${contactId}`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "移入联系人公海" }).click();
  const releaseDialog = page.getByRole("dialog", { name: "移入联系人公海" });
  await expect(releaseDialog).toBeVisible();
  await expect(releaseDialog.getByText(poolName, { exact: true })).toBeVisible();
  await releaseDialog
    .locator(".ant-list-item")
    .filter({ hasText: poolName })
    .getByRole("button", { name: "移入此公海" })
    .click();

  await expect(page).toHaveURL(new RegExp(`/crm/contact-pools/${poolId}$`));
  await expect(page.getByRole("heading", { exact: true, name: "公海联系人" })).toBeVisible();
  await expect(page.getByRole("link", { exact: true, name: contactName }).first()).toBeVisible();
});
