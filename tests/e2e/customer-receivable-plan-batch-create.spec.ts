import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = { "X-Dev-Tenant-Id": "900001", "X-Dev-User-Id": "900001" };

// The isolated preview server may need to transform the batch-create route on its first visit.
// Keep this one setup-heavy integration flow independent from that cold-start latency.
test.setTimeout(120_000);

function identifierFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const identifier = (value as { id?: unknown }).id;
  return typeof identifier === "number" && Number.isSafeInteger(identifier) && identifier > 0
    ? identifier
    : null;
}

test("customer plans batch-create direct rows from a server-visible contract", async ({ page }) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Batch Plan Customer ${suffix}` },
    headers,
  });
  const customerId = identifierFrom(await customerResponse.json());
  if (!customerResponse.ok() || customerId === null) throw new Error("Customer setup failed.");
  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-BRP-P-${suffix}`,
      listPrice: 100,
      name: `E2E Batch Plan Product ${suffix}`,
    },
    headers,
  });
  const productId = identifierFrom(await productResponse.json());
  if (!productResponse.ok() || productId === null) throw new Error("Product setup failed.");
  const contractNumber = `E2E-BRP-${suffix}`;
  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Batch Plan Contract ${suffix}`,
      number: contractNumber,
      products: [{ productId, quantity: 1 }],
    },
    headers,
  });
  const contractId = identifierFrom(await contractResponse.json());
  if (!contractResponse.ok() || contractId === null) throw new Error("Contract setup failed.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "查看回款计划", exact: true }).click();
  await page.getByRole("button", { name: "批量新建", exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/receivable-plans/batch-new`);

  const contractQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contracts/query" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "选择合同", exact: true }).click();
  expect((await contractQuery).postDataJSON()).toEqual({ customerId, page: 1, size: 50 });
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: new RegExp(contractNumber) }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /选\s*择/ })
    .click();

  await page.getByLabel("第 1 条到期日期").fill("2026-08-26");
  await page.getByLabel("第 1 条计划金额").fill("12.34");
  await page.getByLabel("第 1 条收款方式").fill("TRANSFER");
  await page.getByRole("button", { name: /添加计划行/ }).click();
  await page.getByLabel("第 2 条到期日期").fill("2026-09-26");
  await page.getByLabel("第 2 条计划金额").fill("23.45");
  await page.getByLabel("第 2 条收款方式").fill("TRANSFER");
  const batchCreateRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/receivable-plans/batch" &&
      request.method() === "POST",
  );
  await page.getByRole("button", { name: "批量创建回款计划", exact: true }).click();

  const request = await batchCreateRequest;
  expect(request.postDataJSON()).toEqual({
    contractId,
    plans: [
      { dueDate: "2026-08-26", paymentMethod: "TRANSFER", plannedAmount: 12.34 },
      { dueDate: "2026-09-26", paymentMethod: "TRANSFER", plannedAmount: 23.45 },
    ],
  });
  expect((await request.response())?.ok()).toBeTruthy();
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/receivable-plans`);
});
