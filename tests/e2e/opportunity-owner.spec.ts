import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const ownerHeaders = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

interface CatalogEntry {
  id: number;
  code: string;
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

function activeCatalogEntry(value: unknown): CatalogEntry | null {
  const objectList = recordOf(value)?.objectList;
  if (!Array.isArray(objectList)) return null;

  for (const item of objectList) {
    const record = recordOf(item);
    const id = responseId(record);
    const code = typeof record?.code === "string" ? record.code : null;
    if (id !== null && id > 0 && code !== null && record?.status === "ACTIVE") return { code, id };
  }
  return null;
}

test("an opportunity owner assigns a visible active member with the current version", async ({
  page,
}) => {
  const assigneeActorId = 900014;
  const assigneeTenantId = 900015;
  const assigneeName = "E2E Opportunity Owner";
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

  const suffix = Date.now();
  const name = `E2E Opportunity Owner ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `${name} Customer` },
    headers: ownerHeaders,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = responseId(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer creation did not return an ID.");

  const opportunityResponse = await page.request.post(`${baseUrl}/api/v1/opportunities`, {
    data: { customerId, name, pipelineCode: pipeline.code, stageCode: stage.code },
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
  await expect(page.getByRole("main").last().getByText(`成员 ${assigneeActorId}`)).toBeVisible();
});
