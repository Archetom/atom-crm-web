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
    return id !== null && code !== null && record.status === "ACTIVE" ? [{ code, id }] : [];
  });
}

test("opportunity list posts its URL query and shows its follow-up summary column", async ({
  page,
}, testInfo) => {
  const pipelineResponse = await page.request.post(
    `${baseUrl}/api/v1/opportunity-pipelines/query`,
    {
      data: { page: 1, size: 50 },
      headers,
    },
  );
  expect(pipelineResponse.ok()).toBeTruthy();
  const [pipeline] = activeCatalogEntries(await pipelineResponse.json());
  expect(pipeline).toBeDefined();
  if (pipeline === undefined)
    throw new Error("No active opportunity pipeline is available for E2E.");

  const stageResponse = await page.request.post(
    `${baseUrl}/api/v1/opportunity-pipelines/${pipeline.id}/stages/query`,
    {
      data: { page: 1, size: 50 },
      headers,
    },
  );
  expect(stageResponse.ok()).toBeTruthy();
  const [stage] = activeCatalogEntries(await stageResponse.json());
  expect(stage).toBeDefined();
  if (stage === undefined) throw new Error("No active opportunity stage is available for E2E.");

  const suffix = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const opportunityName = `E2E Opportunity ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `${opportunityName} Customer` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = positiveIdentifier(recordOf(await customerResponse.json())?.id);
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer creation did not return an ID.");

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

  let opportunityRequest: { body: unknown; method: string; url: string } | null = null;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/opportunities/query") {
      opportunityRequest = {
        body: request.postDataJSON(),
        method: request.method(),
        url: request.url(),
      };
    }
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(
    `${baseUrl}/crm/opportunities?page=1&size=50&keyword=${encodeURIComponent(opportunityName)}`,
    { waitUntil: "networkidle" },
  );

  await expect(page.getByRole("heading", { name: "商机管理", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("搜索商机")).toHaveValue(opportunityName);
  await expect(page.getByRole("columnheader", { name: "最后跟进时间", exact: true })).toBeVisible();
  await expect(
    page.getByLabel("桌面列表").getByText(opportunityName, { exact: true }),
  ).toBeVisible();
  await expect.poll(() => opportunityRequest?.url).toBe(`${baseUrl}/api/v1/opportunities/query`);
  expect(opportunityRequest?.method).toBe("POST");
  expect(opportunityRequest?.body).toEqual({
    keyword: opportunityName,
    page: 1,
    size: 50,
  });

  await page.getByRole("button", { name: opportunityName, exact: true }).click();
  await expect(page).toHaveURL(new RegExp("[?&]opportunityId=\\d+"));
  const opportunityDrawer = page.getByRole("dialog", { name: "商机详情" });
  await expect(opportunityDrawer).toBeVisible();
  await expect(
    opportunityDrawer.getByRole("heading", { name: opportunityName, exact: true }),
  ).toBeVisible();
  await expect(opportunityDrawer.getByText(`客户 ${customerId}`, { exact: true })).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(opportunityDrawer).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.get("opportunityId")).toBeNull();
  await expect(page.getByRole("button", { name: opportunityName, exact: true })).toBeFocused();
});
