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

function activeCatalogEntries(value: unknown): CatalogEntry[] {
  const objectList = recordOf(value)?.objectList;
  if (!Array.isArray(objectList)) return [];

  return objectList.flatMap((item) => {
    const record = recordOf(item);
    const id = positiveIdentifier(record?.id);
    const code = typeof record?.code === "string" ? record.code : null;
    return id !== null && code !== null && record?.status === "ACTIVE" ? [{ code, id }] : [];
  });
}

test("opportunity detail advances through a server-listed active stage with its current version", async ({
  page,
}) => {
  const pipelineResponse = await page.request.post(
    `${baseUrl}/api/v1/opportunity-pipelines/query`,
    { data: { page: 1, size: 50, status: "ACTIVE" }, headers },
  );
  expect(pipelineResponse.ok()).toBeTruthy();
  const [pipeline] = activeCatalogEntries(await pipelineResponse.json());
  expect(pipeline).toBeDefined();
  if (pipeline === undefined)
    throw new Error("No active opportunity pipeline is available for E2E.");

  const stagesResponse = await page.request.post(
    `${baseUrl}/api/v1/opportunity-pipelines/${pipeline.id}/stages/query`,
    { data: { page: 1, size: 50, status: "ACTIVE" }, headers },
  );
  expect(stagesResponse.ok()).toBeTruthy();
  const [initialStage, targetStage] = activeCatalogEntries(await stagesResponse.json());
  expect(initialStage).toBeDefined();
  expect(targetStage).toBeDefined();
  if (initialStage === undefined || targetStage === undefined) {
    throw new Error("Two active opportunity stages are required for E2E.");
  }

  const suffix = Date.now();
  const name = `E2E Opportunity Stage ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `${name} Customer` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = positiveIdentifier(recordOf(await customerResponse.json())?.id);
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer creation did not return an ID.");

  const opportunityResponse = await page.request.post(`${baseUrl}/api/v1/opportunities`, {
    data: {
      customerId,
      name,
      pipelineCode: pipeline.code,
      stageCode: initialStage.code,
    },
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
  await page.getByRole("button", { name: "推进阶段" }).click();
  const dialog = page.getByRole("dialog", { name: "推进销售阶段" });
  const stageSelect = dialog.getByLabel("目标销售阶段");
  await expect(stageSelect).toBeEnabled();
  await stageSelect.click();
  await stageSelect.press("ArrowDown");
  await stageSelect.press("Enter");
  await dialog.getByRole("button", { name: "更新阶段" }).click();

  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("main").last().getByText(targetStage.code, { exact: true }),
  ).toBeVisible();
});
