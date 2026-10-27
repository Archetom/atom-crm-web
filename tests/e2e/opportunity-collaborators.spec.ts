import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const ownerHeaders = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

test.setTimeout(60_000);

interface CatalogEntry {
  code: string;
  id: number;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function responseId(value: unknown): number | null {
  const id = recordOf(value)?.id;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function versionFrom(value: unknown): number | null {
  const version = recordOf(value)?.version;
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0
    ? version
    : null;
}

function activeCatalogEntry(value: unknown): CatalogEntry | null {
  const objectList = recordOf(value)?.objectList;
  if (!Array.isArray(objectList)) return null;

  for (const item of objectList) {
    const record = recordOf(item);
    const id = responseId(record);
    const code = typeof record?.code === "string" ? record.code : null;
    if (id !== null && code !== null && record?.status === "ACTIVE") return { code, id };
  }
  return null;
}

test("an opportunity owner replaces collaborators from the authoritative versioned baseline", async ({
  page,
}, testInfo) => {
  const suffix = Date.now();
  const applicantActorId = 900044;
  const applicantTenantId = 900045;
  const applicantName = `E2E Opportunity Collaborator ${suffix}`;
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

  const pipelineResponse = await page.request.post(
    `${baseUrl}/api/v1/opportunity-pipelines/query`,
    { data: { page: 1, size: 50, status: "ACTIVE" }, headers: ownerHeaders },
  );
  expect(pipelineResponse.ok()).toBeTruthy();
  const pipeline = activeCatalogEntry(await pipelineResponse.json());
  expect(pipeline).not.toBeNull();
  if (pipeline === null) throw new Error("No active opportunity pipeline is available for E2E.");

  const stageResponse = await page.request.post(
    `${baseUrl}/api/v1/opportunity-pipelines/${pipeline.id}/stages/query`,
    { data: { page: 1, size: 50, status: "ACTIVE" }, headers: ownerHeaders },
  );
  expect(stageResponse.ok()).toBeTruthy();
  const stage = activeCatalogEntry(await stageResponse.json());
  expect(stage).not.toBeNull();
  if (stage === null) throw new Error("No active opportunity stage is available for E2E.");

  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Opportunity Collaboration Customer ${suffix}` },
    headers: ownerHeaders,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = responseId(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer creation did not return an ID.");

  const opportunityResponse = await page.request.post(`${baseUrl}/api/v1/opportunities`, {
    data: {
      customerId,
      name: `E2E Opportunity Collaboration ${suffix}`,
      pipelineCode: pipeline.code,
      stageCode: stage.code,
    },
    headers: ownerHeaders,
  });
  expect(opportunityResponse.ok()).toBeTruthy();
  const opportunityId = responseId(await opportunityResponse.json());
  expect(opportunityId).not.toBeNull();
  if (opportunityId === null) throw new Error("Opportunity creation did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/opportunities/${opportunityId}`, { waitUntil: "networkidle" });

  const baselineResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/opportunities/${opportunityId}/collaborators` &&
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
      new URL(request.url()).pathname === `/api/v1/opportunities/${opportunityId}/collaborators` &&
      request.method() === "PUT",
  );
  await dialog.getByRole("button", { name: "保存协作者" }).click();
  expect((await replaceRequest).postDataJSON()).toEqual({
    collaborators: [{ access: "READ", actorId: applicantActorId }],
    version,
  });
  await expect(dialog).toBeHidden();

  const collaboratorsResponse = await page.request.get(
    `${baseUrl}/api/v1/opportunities/${opportunityId}/collaborators`,
    { headers: ownerHeaders },
  );
  expect(collaboratorsResponse.ok()).toBeTruthy();
  await expect(collaboratorsResponse.json()).resolves.toMatchObject({
    callerState: "OWNER",
    collaborators: [{ actorId: applicantActorId, access: "READ" }],
  });
  await page.screenshot({
    path: testInfo.outputPath("opportunity-collaborators-success.png"),
    fullPage: true,
  });
});
