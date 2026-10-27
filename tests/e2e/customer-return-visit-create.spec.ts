import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function customerIdFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { id } = value as { id?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

test("customer-context return visit creation uses only the explicit basic fields", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Return Visit Create Customer ${suffix}`;
  const remark = `E2E 新建回访备注 ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = customerIdFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/return-visits`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "新建回访" }).click();

  await expect(page.getByRole("heading", { name: "新建回访", exact: true })).toBeVisible();
  await page.getByLabel("客户反馈").fill(remark);
  const createRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/return-visits" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建回访" }).click();

  const payload = (await createRequest).postDataJSON() as {
    customerId?: unknown;
    ownerActorId?: unknown;
    remark?: unknown;
    visitTime?: unknown;
  };
  expect(payload).toMatchObject({ customerId, remark });
  expect(payload).not.toHaveProperty("ownerActorId");
  expect(payload.visitTime).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/));

  await expect(page).toHaveURL(new RegExp(`/crm/customers/${customerId}/return-visits/\\d+$`));
  await expect(page.getByText(remark, { exact: true })).toBeVisible();
});

test("customer-context creation sends an explicitly selected visible return-visit owner", async ({
  page,
}) => {
  const suffix = Date.now();
  const assigneeActorId = 900031;
  const assigneeTenantId = 900032;
  const assigneeName = "E2E Return Visit Create Owner";
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
    const membershipRequest = await membershipResponse.json();
    const membershipRequestId = customerIdFrom(membershipRequest);
    expect(membershipRequestId).not.toBeNull();
    if (membershipRequestId === null) {
      throw new Error("Membership request did not return an ID.");
    }
    const approvalResponse = await page.request.post(
      `${baseUrl}/api/v1/organization/membership-requests/${membershipRequestId}/approve`,
      { headers },
    );
    expect(approvalResponse.ok()).toBeTruthy();
  } else {
    expect(membershipResponse.status()).toBe(409);
  }

  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Return Visit Create Owner Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = customerIdFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/return-visits`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "新建回访" }).click();

  const ownerSelect = page.getByLabel("回访人");
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
      new URL(request.url()).pathname === "/api/v1/return-visits" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建回访" }).click();

  const payload = (await createRequest).postDataJSON() as {
    customerId?: unknown;
    ownerActorId?: unknown;
    visitTime?: unknown;
  };
  expect(payload).toMatchObject({ customerId, ownerActorId: assigneeActorId });
  expect(payload.visitTime).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/));

  await expect(page).toHaveURL(new RegExp(`/crm/customers/${customerId}/return-visits/\\d+$`));
  await expect(page.getByText(`成员 ${assigneeActorId}`, { exact: true })).toBeVisible();
});
