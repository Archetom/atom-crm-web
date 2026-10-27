import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const ownerHeaders = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function identifierFrom(value: unknown): number | null {
  const id = recordOf(value)?.id;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function versionFrom(value: unknown): number | null {
  const version = recordOf(value)?.version;
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0
    ? version
    : null;
}

test("a contract owner assigns a visible active member with the current version", async ({
  page,
}) => {
  const suffix = Date.now();
  const assigneeActorId = 900031;
  const assigneeTenantId = 900032;
  const assigneeName = "E2E Contract Owner";
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
    const membershipRequestId = identifierFrom(await membershipResponse.json());
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

  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Contract Owner Customer ${suffix}` },
    headers: ownerHeaders,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Contract Owner ${suffix}`,
      number: `E2E-OWNER-${suffix}`,
      products: [],
    },
    headers: ownerHeaders,
  });
  expect(contractResponse.ok()).toBeTruthy();
  const contract = await contractResponse.json();
  const contractId = identifierFrom(contract);
  const version = versionFrom(contract);
  expect(contractId).not.toBeNull();
  expect(version).not.toBeNull();
  if (contractId === null || version === null) {
    throw new Error("Contract did not return an ID and version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/contracts/${contractId}`, {
    waitUntil: "networkidle",
  });

  await page.getByRole("button", { name: "变更负责人" }).click();
  const dialog = page.getByRole("dialog", { name: "变更负责人" });
  const memberSearch = dialog.getByPlaceholder("按成员姓名搜索");
  await memberSearch.fill(assigneeName);
  await memberSearch.press("Enter");
  const assigneeItem = dialog
    .getByRole("heading", { name: assigneeName, exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(assigneeItem).toBeVisible();

  const updateRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/contracts/${contractId}/owner` &&
      request.method() === "PUT",
  );
  await assigneeItem.getByRole("button", { name: "选择" }).click();
  expect((await updateRequest).postDataJSON()).toEqual({ ownerActorId: assigneeActorId, version });

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("main").getByText(`成员 ${assigneeActorId}`)).toBeVisible();
});
