import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const ownerHeaders = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

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

test("opportunity basic edit clears next contact time without replacing the safe amount baseline", async ({
  page,
}, testInfo) => {
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
  const name = `E2E Opportunity Edit ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `${name} Customer` },
    headers: ownerHeaders,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = responseId(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer creation did not return an ID.");

  const opportunityResponse = await page.request.post(`${baseUrl}/api/v1/opportunities`, {
    data: {
      customerId,
      description: "E2E 原始商机说明",
      estimatedAmount: 1250.5,
      expectedCloseDate: "2026-09-30",
      name,
      nextContactTime: "2026-08-09T09:30:00",
      pipelineCode: pipeline.code,
      stageCode: stage.code,
    },
    headers: ownerHeaders,
  });
  expect(opportunityResponse.ok()).toBeTruthy();
  const opportunityId = responseId(await opportunityResponse.json());
  expect(opportunityId).not.toBeNull();
  if (opportunityId === null) throw new Error("Opportunity creation did not return an ID.");

  const initialBaselineResponse = await page.request.get(
    `${baseUrl}/api/v1/opportunities/${opportunityId}/editable-baseline`,
    { headers: ownerHeaders },
  );
  expect(initialBaselineResponse.ok()).toBeTruthy();
  expect(await initialBaselineResponse.json()).toMatchObject({
    editable: true,
    nextContactTime: "2026-08-09T09:30:00",
  });

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/opportunities/${opportunityId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "编辑基础信息" }).click();
  await expect(page.getByRole("heading", { name: "编辑商机" })).toBeVisible();

  const updatedName = `${name} 已更新`;
  const updatedDescription = "E2E 更新后的商机说明";
  await page.getByLabel("商机名称").fill(updatedName);
  await page.getByLabel("商机说明").fill(updatedDescription);
  await page.getByLabel("下次联系时间").fill("");
  await page.getByRole("button", { name: "保存修改" }).click();

  await expect(page).toHaveURL(new RegExp(`/crm/opportunities/${opportunityId}$`));
  await expect(page.getByText(updatedDescription)).toBeVisible();

  const baselineResponse = await page.request.get(
    `${baseUrl}/api/v1/opportunities/${opportunityId}/editable-baseline`,
    { headers: ownerHeaders },
  );
  expect(baselineResponse.ok()).toBeTruthy();
  const updatedBaseline: unknown = await baselineResponse.json();
  expect(updatedBaseline).toMatchObject({
    editable: true,
    estimatedAmount: 1250.5,
    name: updatedName,
  });
  expect(updatedBaseline).not.toHaveProperty("nextContactTime");
  await page.screenshot({
    path: testInfo.outputPath("opportunity-edit-success.png"),
    fullPage: true,
  });
});
