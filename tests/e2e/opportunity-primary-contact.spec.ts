import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
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

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function responseId(value: unknown): number | null {
  return positiveIdentifier(recordOf(value)?.id);
}

function responseVersion(value: unknown): number | null {
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
    const id = positiveIdentifier(record?.id);
    const code = typeof record?.code === "string" ? record.code : null;
    if (id !== null && code !== null && record?.status === "ACTIVE") return { code, id };
  }
  return null;
}

test("opportunity detail sets and clears a primary contact from its server-visible relations", async ({
  page,
}) => {
  const pipelineResponse = await page.request.post(
    `${baseUrl}/api/v1/opportunity-pipelines/query`,
    { data: { page: 1, size: 50, status: "ACTIVE" }, headers },
  );
  expect(pipelineResponse.ok()).toBeTruthy();
  const pipeline = activeCatalogEntry(await pipelineResponse.json());
  expect(pipeline).not.toBeNull();
  if (pipeline === null) throw new Error("No active opportunity pipeline is available for E2E.");

  const stageResponse = await page.request.post(
    `${baseUrl}/api/v1/opportunity-pipelines/${pipeline.id}/stages/query`,
    { data: { page: 1, size: 50, status: "ACTIVE" }, headers },
  );
  expect(stageResponse.ok()).toBeTruthy();
  const stage = activeCatalogEntry(await stageResponse.json());
  expect(stage).not.toBeNull();
  if (stage === null) throw new Error("No active opportunity stage is available for E2E.");

  const suffix = Date.now();
  const opportunityName = `E2E Opportunity Primary Contact ${suffix}`;
  const contactName = `E2E Opportunity Contact ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `${opportunityName} Customer` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = responseId(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer creation did not return an ID.");

  const contactResponse = await page.request.post(`${baseUrl}/api/v1/contacts`, {
    data: { customerId, name: contactName },
    headers,
  });
  expect(contactResponse.ok()).toBeTruthy();
  const contactId = responseId(await contactResponse.json());
  expect(contactId).not.toBeNull();
  if (contactId === null) throw new Error("Contact creation did not return an ID.");

  const opportunityResponse = await page.request.post(`${baseUrl}/api/v1/opportunities`, {
    data: {
      customerId,
      name: opportunityName,
      pipelineCode: pipeline.code,
      stageCode: stage.code,
    },
    headers,
  });
  expect(opportunityResponse.ok()).toBeTruthy();
  const opportunity = await opportunityResponse.json();
  const opportunityId = responseId(opportunity);
  const opportunityVersion = responseVersion(opportunity);
  expect(opportunityId).not.toBeNull();
  expect(opportunityVersion).not.toBeNull();
  if (opportunityId === null || opportunityVersion === null) {
    throw new Error("Opportunity creation did not return an ID and version.");
  }

  const attachResponse = await page.request.put(
    `${baseUrl}/api/v1/opportunities/${opportunityId}/contacts`,
    { data: { contactIds: [contactId], version: opportunityVersion }, headers },
  );
  expect(attachResponse.ok()).toBeTruthy();

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/opportunities/${opportunityId}`, { waitUntil: "networkidle" });

  await expect(page.getByText("关联联系人", { exact: true })).toBeVisible();
  const contactItem = page.getByRole("listitem").filter({ hasText: contactName });
  await expect(contactItem.getByText(contactName, { exact: true })).toBeVisible();
  await expect(contactItem.getByText("首要联系人", { exact: true })).toHaveCount(0);

  const primaryAction = page.getByRole("button", { name: "设置首要联系人" });
  await expect(primaryAction).toBeEnabled();
  await primaryAction.click();
  const dialog = page.getByRole("dialog", { name: "设置首要联系人" });
  const primarySelect = dialog.getByLabel("首要联系人");
  await primarySelect.click();
  await primarySelect.press("ArrowDown");
  await primarySelect.press("Enter");
  await dialog.getByRole("button", { name: "保存首要联系人" }).click();

  await expect(dialog).toBeHidden();
  await expect(contactItem.getByText("首要联系人", { exact: true })).toBeVisible();

  await primaryAction.click();
  const clearDialog = page.getByRole("dialog", { name: "设置首要联系人" });
  const clearSelect = clearDialog.getByLabel("首要联系人");
  await clearSelect.click();
  await clearSelect.press("ArrowUp");
  await clearSelect.press("Enter");
  await clearDialog.getByRole("button", { name: "保存首要联系人" }).click();

  await expect(clearDialog).toBeHidden();
  await expect(contactItem.getByText("首要联系人", { exact: true })).toHaveCount(0);
});
