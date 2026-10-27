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

function firstActiveCatalogEntry(value: unknown): CatalogEntry | null {
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

test("opportunity detail updates only the caller's personal star", async ({ page }) => {
  const pipelineResponse = await page.request.post(
    `${baseUrl}/api/v1/opportunity-pipelines/query`,
    { data: { page: 1, size: 50, status: "ACTIVE" }, headers },
  );
  expect(pipelineResponse.ok()).toBeTruthy();
  const pipeline = firstActiveCatalogEntry(await pipelineResponse.json());
  expect(pipeline).not.toBeNull();
  if (pipeline === null) throw new Error("No active opportunity pipeline is available for E2E.");

  const stageResponse = await page.request.post(
    `${baseUrl}/api/v1/opportunity-pipelines/${pipeline.id}/stages/query`,
    { data: { page: 1, size: 50, status: "ACTIVE" }, headers },
  );
  expect(stageResponse.ok()).toBeTruthy();
  const stage = firstActiveCatalogEntry(await stageResponse.json());
  expect(stage).not.toBeNull();
  if (stage === null) throw new Error("No active opportunity stage is available for E2E.");

  const suffix = Date.now();
  const name = `E2E Opportunity Star ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `${name} Customer` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = positiveIdentifier(recordOf(await customerResponse.json())?.id);
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer creation did not return an ID.");

  const opportunityResponse = await page.request.post(`${baseUrl}/api/v1/opportunities`, {
    data: { customerId, name, pipelineCode: pipeline.code, stageCode: stage.code },
    headers,
  });
  expect(opportunityResponse.ok()).toBeTruthy();
  const opportunityId = positiveIdentifier(recordOf(await opportunityResponse.json())?.id);
  expect(opportunityId).not.toBeNull();
  if (opportunityId === null) throw new Error("Opportunity creation did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/opportunities/${opportunityId}`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "关注" }).click();
  await expect(page.getByRole("button", { name: "取消关注" })).toBeVisible();
});
