import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const ownerHeaders = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function identifierFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { id } = value as { id?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

test("customer contract creation sends only an explicitly selected server-visible owner", async ({
  page,
}) => {
  const suffix = Date.now();
  const assigneeActorId = 900081;
  const assigneeTenantId = 900082;
  const assigneeName = "E2E Contract Create Owner";
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
    if (membershipRequestId === null) {
      throw new Error("Membership request did not return an ID.");
    }
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
  if (customerId === null) {
    throw new Error("Customer did not return an ID.");
  }

  const contractName = `E2E Contract Owner ${suffix}`;
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/contracts/new`, {
    waitUntil: "networkidle",
  });
  await page.getByLabel("合同名称").fill(contractName);
  await page.getByLabel("合同编号").fill(`E2E-CONTRACT-OWNER-${suffix}`);
  const ownerSelect = page.getByLabel("负责人");
  await expect(ownerSelect).toBeVisible();
  await ownerSelect.click();
  const ownerDirectoryResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/organization/members" &&
      response.request().method() === "GET" &&
      new URL(response.url()).searchParams.get("keyword") === assigneeName,
  );
  await ownerSelect.fill(assigneeName);
  await ownerDirectoryResponse;
  await page.getByText(assigneeName, { exact: true }).last().click();

  const createRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contracts" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建合同" }).click();

  expect((await createRequest).postDataJSON()).toMatchObject({
    customerId,
    name: contractName,
    ownerActorId: assigneeActorId,
  });
  await expect(page).toHaveURL(new RegExp(`/crm/customers/${customerId}/contracts/\\d+$`));
});
