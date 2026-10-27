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

test("a contract owner replaces collaborators from the authoritative versioned baseline", async ({
  page,
}) => {
  const suffix = Date.now();
  const applicantActorId = 900042;
  const applicantTenantId = 900043;
  const applicantName = `E2E Contract Collaborator ${suffix}`;
  const applicantHeaders = {
    "X-Dev-Tenant-Id": String(applicantTenantId),
    "X-Dev-User-Id": String(applicantActorId),
  };
  const profileResponse = await page.request.put(`${baseUrl}/api/v1/organization/profile`, {
    data: { displayName: applicantName },
    headers: applicantHeaders,
  });
  expect(profileResponse.ok()).toBeTruthy();

  const membershipResponse = await page.request.post(
    `${baseUrl}/api/v1/organization/membership-requests`,
    { data: { targetTenantId: 900001 }, headers: applicantHeaders },
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
    data: { name: `E2E Contract Collaboration Customer ${suffix}` },
    headers: ownerHeaders,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Contract Collaboration ${suffix}`,
      number: `E2E-CC-${suffix}`,
      products: [],
    },
    headers: ownerHeaders,
  });
  expect(contractResponse.ok()).toBeTruthy();
  const contractId = identifierFrom(await contractResponse.json());
  expect(contractId).not.toBeNull();
  if (contractId === null) throw new Error("Contract did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/contracts/${contractId}`, {
    waitUntil: "networkidle",
  });

  const baselineResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/contracts/${contractId}/collaborators` &&
      response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "管理协作者" }).click();
  const dialog = page.getByRole("dialog", { name: "管理协作者" });
  const baseline = await (await baselineResponse).json();
  expect(recordOf(baseline)?.callerState).toBe("OWNER");
  const version = versionFrom(baseline);
  expect(version).not.toBeNull();
  if (version === null) throw new Error("Collaborator baseline did not return a version.");

  await expect(dialog.getByText("暂无协作者")).toBeVisible();
  const memberSearch = dialog.getByPlaceholder("按成员姓名搜索");
  await memberSearch.fill(applicantName);
  await memberSearch.press("Enter");
  const memberItem = dialog
    .getByRole("heading", { name: applicantName, exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(memberItem).toBeVisible();
  await memberItem.getByRole("button", { name: "添加为只读" }).click();

  const replaceRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/contracts/${contractId}/collaborators` &&
      request.method() === "PUT",
  );
  await dialog.getByRole("button", { name: "保存协作者" }).click();
  expect((await replaceRequest).postDataJSON()).toEqual({
    collaborators: [{ access: "READ", actorId: applicantActorId }],
    version,
  });
  await expect(dialog).toBeHidden();

  const collaboratorsResponse = await page.request.get(
    `${baseUrl}/api/v1/contracts/${contractId}/collaborators`,
    { headers: ownerHeaders },
  );
  expect(collaboratorsResponse.ok()).toBeTruthy();
  await expect(collaboratorsResponse.json()).resolves.toMatchObject({
    callerState: "OWNER",
    collaborators: [{ actorId: applicantActorId, access: "READ" }],
  });
});
