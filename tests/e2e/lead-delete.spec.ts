import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function leadIdentity(value: unknown): { id: number; version: number } | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;

  const { id, version } = value as { id?: unknown; version?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 && typeof version === "number"
    ? { id, version }
    : null;
}

test("lead detail explicitly soft-deletes a lead with its current version", async ({ page }) => {
  const leadName = `E2E Delete Lead ${Date.now()}`;
  const leadResponse = await page.request.post(`${baseUrl}/api/v1/leads`, {
    data: { name: leadName },
    headers,
  });
  expect(leadResponse.ok()).toBeTruthy();
  const lead = leadIdentity(await leadResponse.json());
  expect(lead).not.toBeNull();
  if (lead === null) throw new Error("Lead did not return an ID and version.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/leads/${lead.id}`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: leadName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "删除线索" }).click();
  const confirmation = page.getByRole("tooltip", { name: `删除线索“${leadName}”？` });
  await expect(confirmation).toBeVisible();
  const deleteRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/leads/${lead.id}` &&
      request.method() === "DELETE",
  );
  await confirmation.getByRole("button", { name: "确认删除" }).click();

  expect(new URL((await deleteRequest).url()).searchParams.get("version")).toBe(
    String(lead.version),
  );
  await expect(page).toHaveURL(`${baseUrl}/crm/leads`);
});
