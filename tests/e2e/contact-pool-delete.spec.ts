import { expect, test } from "./support/contact-pool-test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("a pool administrator batch soft-deletes versioned pool contacts", async ({
  page,
  contactPoolIdentity,
}) => {
  const poolName = `E2E Delete Pool ${Date.now()}`;
  const contactNames = [`${poolName} Contact A`, `${poolName} Contact B`];
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

  const contacts = await Promise.all(
    contactNames.map(async (name) => {
      const response = await page.request.post(`${baseUrl}/api/v1/contacts`, {
        data: { name },
        headers: contactPoolIdentity.headers,
      });
      expect(response.ok()).toBeTruthy();
      const payload: unknown = await response.json();
      const contact =
        payload !== null &&
        typeof payload === "object" &&
        typeof (payload as { id?: unknown }).id === "number" &&
        typeof (payload as { version?: unknown }).version === "number"
          ? (payload as { id: number; version: number })
          : null;
      expect(contact).not.toBeNull();
      if (contact === null) throw new Error("Contact creation did not return an ID and version.");
      return contact;
    }),
  );
  const releaseResponse = await page.request.post(
    `${baseUrl}/api/v1/contact-pools/${poolId}/contacts/release`,
    {
      data: {
        contacts: contacts.map((contact) => ({ contactId: contact.id, version: contact.version })),
      },
      headers: contactPoolIdentity.headers,
    },
  );
  expect(releaseResponse.ok()).toBeTruthy();

  await page.goto(`${baseUrl}/crm/contact-pools/${poolId}`, { waitUntil: "networkidle" });

  const desktopList = page.getByLabel("桌面列表");
  for (const contactName of contactNames) {
    await expect(desktopList.getByText(contactName, { exact: true })).toBeVisible();
  }
  await desktopList.getByRole("checkbox").first().check();
  await page.getByRole("button", { exact: true, name: "批量删除" }).click();
  await page.getByRole("button", { exact: true, name: "确认删除" }).click();

  for (const contactName of contactNames) {
    await expect(desktopList.getByText(contactName, { exact: true })).not.toBeVisible();
  }
});
