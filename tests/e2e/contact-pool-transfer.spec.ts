import { expect, test } from "./support/contact-pool-test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
test("a pool administrator transfers all pool contacts to a server-listed active pool", async ({
  page,
  contactPoolIdentity,
}) => {
  const suffix = Date.now();
  const sourceName = `E2E Transfer Source ${suffix}`;
  const targetName = `E2E Transfer Target ${suffix}`;
  const createPoolRequest = (name: string) =>
    page.request.post(`${baseUrl}/api/v1/contact-pools`, {
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
  const sourceResponse = await createPoolRequest(sourceName);
  expect(sourceResponse.ok()).toBeTruthy();
  const sourcePayload: unknown = await sourceResponse.json();
  const sourceId =
    sourcePayload !== null &&
    typeof sourcePayload === "object" &&
    typeof (sourcePayload as { id?: unknown }).id === "number"
      ? (sourcePayload as { id: number }).id
      : null;
  expect(sourceId).not.toBeNull();
  if (sourceId === null) throw new Error("Source contact pool creation did not return an ID.");

  const targetResponse = await createPoolRequest(targetName);
  expect(targetResponse.ok()).toBeTruthy();

  const contactName = `E2E Transfer Contact ${suffix}`;
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
    `${baseUrl}/api/v1/contact-pools/${sourceId}/contacts/release`,
    {
      data: { contacts: [{ contactId: contact.id, version: contact.version }] },
      headers: contactPoolIdentity.headers,
    },
  );
  expect(releaseResponse.ok()).toBeTruthy();

  await page.goto(`${baseUrl}/crm/contact-pools/manage`, { waitUntil: "networkidle" });

  const desktopList = page.getByLabel("桌面列表");
  const sourceRow = desktopList.locator("tr").filter({ hasText: sourceName });
  const targetRow = desktopList.locator("tr").filter({ hasText: targetName });
  await sourceRow.getByRole("button", { exact: true, name: "转移联系人" }).click();
  const dialog = page.getByRole("dialog", { name: "转移联系人公海" });
  await dialog
    .getByRole("listitem")
    .filter({ hasText: targetName })
    .getByRole("button", { exact: true, name: "选择目标公海" })
    .click();
  await dialog.getByRole("button", { exact: true, name: "确认转移" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(sourceRow).toContainText("0 位");
  await expect(targetRow).toContainText("1 位");
});
