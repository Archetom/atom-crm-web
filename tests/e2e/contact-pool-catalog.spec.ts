import { expect, test } from "./support/contact-pool-test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("contact-pool catalog opens the server-scoped contact list", async ({
  page,
  contactPoolIdentity,
}) => {
  const name = `E2E Contact Pool ${Date.now()}`;
  const contactName = `${name} Contact`;
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
  const poolPayload: unknown = await response.json();
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
  const contact =
    contactPayload !== null &&
    typeof contactPayload === "object" &&
    typeof (contactPayload as { id?: unknown }).id === "number" &&
    typeof (contactPayload as { version?: unknown }).version === "number"
      ? (contactPayload as { id: number; version: number })
      : null;
  expect(contact).not.toBeNull();
  if (contact === null) throw new Error("Contact creation did not return an ID and version.");

  const releaseResponse = await page.request.post(
    `${baseUrl}/api/v1/contact-pools/${poolId}/contacts/release`,
    {
      data: { contacts: [{ contactId: contact.id, version: contact.version }] },
      headers: contactPoolIdentity.headers,
    },
  );
  expect(releaseResponse.ok()).toBeTruthy();

  await page.goto(`${baseUrl}/crm/contact-pools`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { exact: true, name: "联系人公海" }).last()).toBeVisible();
  const poolCard = page.locator(".ant-card").filter({ hasText: name });
  await expect(poolCard).toContainText("启用");
  await expect(poolCard).toContainText("公海管理员");
  await expect(poolCard).toContainText("服务端当前统计：1 位联系人");
  await poolCard.getByRole("link", { name: "查看联系人" }).click();

  await expect(page).toHaveURL(new RegExp(`/crm/contact-pools/${poolId}$`));
  await expect(page.getByRole("heading", { exact: true, name: "公海联系人" })).toBeVisible();
  await expect(page.getByPlaceholder("搜索公海内联系人")).toBeVisible();
  await expect(page.getByRole("link", { exact: true, name: contactName }).first()).toBeVisible();
});
