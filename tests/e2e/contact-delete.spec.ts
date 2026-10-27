import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function contactIdentity(value: unknown): { id: number; version: number } | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;

  const { id, version } = value as { id?: unknown; version?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 && typeof version === "number"
    ? { id, version }
    : null;
}

test("contact detail explicitly soft-deletes a contact with its current version", async ({
  page,
}) => {
  const contactName = `E2E Delete Contact ${Date.now()}`;
  const contactResponse = await page.request.post(`${baseUrl}/api/v1/contacts`, {
    data: { name: contactName },
    headers,
  });
  expect(contactResponse.ok()).toBeTruthy();
  const contact = contactIdentity(await contactResponse.json());
  expect(contact).not.toBeNull();
  if (contact === null) throw new Error("Contact did not return an ID and version.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/contacts/${contact.id}`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: contactName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "删除联系人" }).click();
  const confirmation = page.getByRole("tooltip", { name: `删除联系人“${contactName}”？` });
  await expect(confirmation).toBeVisible();
  const deleteRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/contacts/${contact.id}` &&
      request.method() === "DELETE",
  );
  await confirmation.getByRole("button", { name: "确认删除" }).click();

  expect(new URL((await deleteRequest).url()).searchParams.get("version")).toBe(
    String(contact.version),
  );
  await expect(page).toHaveURL(`${baseUrl}/crm/contacts`);
});
