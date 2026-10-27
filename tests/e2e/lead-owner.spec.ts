import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const ownerHeaders = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function responseId(value: unknown): number | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "number"
    ? (value as { id: number }).id
    : null;
}

test("a lead owner assigns a visible active member with the current version", async ({ page }) => {
  const suffix = Date.now();
  const assigneeActorId = 900004;
  const assigneeTenantId = 900005;
  const assigneeName = "E2E Lead Owner";
  const assigneeHeaders = {
    "X-Dev-Tenant-Id": String(assigneeTenantId),
    "X-Dev-User-Id": String(assigneeActorId),
  };
  const profileResponse = await page.request.put(`${baseUrl}/api/v1/organization/profile`, {
    data: { displayName: assigneeName },
    headers: assigneeHeaders,
  });
  expect(profileResponse.ok()).toBeTruthy();

  const membershipResponse = await page.request.post(
    `${baseUrl}/api/v1/organization/membership-requests`,
    {
      data: { targetTenantId: 900001 },
      headers: assigneeHeaders,
    },
  );
  if (membershipResponse.ok()) {
    const membershipRequestId = responseId(await membershipResponse.json());
    expect(membershipRequestId).not.toBeNull();

    const approvalResponse = await page.request.post(
      `${baseUrl}/api/v1/organization/membership-requests/${membershipRequestId}/approve`,
      { headers: ownerHeaders },
    );
    expect(approvalResponse.ok()).toBeTruthy();
  } else {
    expect(membershipResponse.status()).toBe(409);
  }

  const leadResponse = await page.request.post(`${baseUrl}/api/v1/leads`, {
    data: { name: `E2E Lead Owner ${suffix}` },
    headers: ownerHeaders,
  });
  expect(leadResponse.ok()).toBeTruthy();
  const leadId = responseId(await leadResponse.json());
  expect(leadId).not.toBeNull();

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/leads/${leadId}`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "变更负责人" }).click();
  const dialog = page.getByRole("dialog", { name: "变更负责人" });
  const memberSearch = dialog.getByPlaceholder("按成员姓名搜索");
  await memberSearch.fill(assigneeName);
  await memberSearch.press("Enter");
  const assigneeItem = dialog
    .getByRole("heading", { name: assigneeName, exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(assigneeItem).toBeVisible();
  await assigneeItem.getByRole("button", { name: "选择" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(String(assigneeActorId), { exact: true })).toBeVisible();
});
