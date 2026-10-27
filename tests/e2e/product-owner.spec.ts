import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const ownerHeaders = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function productIdentity(value: unknown): { id: number; version: number } | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;

  const { id, version } = value as { id?: unknown; version?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 && typeof version === "number"
    ? { id, version }
    : null;
}

function responseId(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;

  const { id } = value as { id?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

test("a product owner assigns a server-visible active member with the current version", async ({
  page,
}) => {
  const assigneeActorId = 900024;
  const assigneeTenantId = 900025;
  const assigneeName = "E2E Product Owner";
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
    { data: { targetTenantId: 900001 }, headers: assigneeHeaders },
  );
  if (membershipResponse.ok()) {
    const membershipRequestId = responseId(await membershipResponse.json());
    expect(membershipRequestId).not.toBeNull();
    if (membershipRequestId === null) throw new Error("Membership request did not return an ID.");

    const approvalResponse = await page.request.post(
      `${baseUrl}/api/v1/organization/membership-requests/${membershipRequestId}/approve`,
      { headers: ownerHeaders },
    );
    expect(approvalResponse.ok()).toBeTruthy();
  } else {
    expect(membershipResponse.status()).toBe(409);
  }

  const suffix = Date.now();
  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-OWNER-${suffix}`,
      listPrice: 10,
      name: `E2E Product Owner ${suffix}`,
    },
    headers: ownerHeaders,
  });
  expect(productResponse.ok()).toBeTruthy();
  const product = productIdentity(await productResponse.json());
  expect(product).not.toBeNull();
  if (product === null) throw new Error("Product did not return an ID and version.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/products/${product.id}`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "变更负责人" }).click();
  const dialog = page.getByRole("dialog", { name: "变更负责人" });
  const memberSearch = dialog.getByPlaceholder("按成员姓名搜索");
  await memberSearch.fill(assigneeName);
  await memberSearch.press("Enter");
  const assigneeItem = dialog
    .getByRole("heading", { name: assigneeName, exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(assigneeItem).toBeVisible();

  const ownerRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/products/${product.id}/owner` &&
      request.method() === "PUT",
  );
  await assigneeItem.getByRole("button", { name: "选择" }).click();
  expect((await ownerRequest).postDataJSON()).toEqual({
    ownerActorId: assigneeActorId,
    version: product.version,
  });
  await expect(dialog).toBeHidden();
});
