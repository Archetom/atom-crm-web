import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = { "X-Dev-Tenant-Id": "900001", "X-Dev-User-Id": "900001" };

// The isolated preview server may need to transform the optional-plan route on its first visit.
test.setTimeout(120_000);

function identifierFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const identifier = (value as { id?: unknown }).id;
  return typeof identifier === "number" && Number.isSafeInteger(identifier) && identifier > 0
    ? identifier
    : null;
}

test("customer receivable creation associates only a server-visible plan from its selected contract", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Plan-linked Receivable Customer ${suffix}` },
    headers,
  });
  const customerId = identifierFrom(await customerResponse.json());
  if (!customerResponse.ok() || customerId === null) throw new Error("Customer setup failed.");

  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-PLR-P-${suffix}`,
      listPrice: 100,
      name: `E2E Plan-linked Receivable Product ${suffix}`,
    },
    headers,
  });
  const productId = identifierFrom(await productResponse.json());
  if (!productResponse.ok() || productId === null) throw new Error("Product setup failed.");

  const contractNumber = `E2E-PLR-${suffix}`;
  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Plan-linked Receivable Contract ${suffix}`,
      number: contractNumber,
      products: [{ productId, quantity: 1 }],
    },
    headers,
  });
  const contractId = identifierFrom(await contractResponse.json());
  if (!contractResponse.ok() || contractId === null) throw new Error("Contract setup failed.");

  const planResponse = await page.request.post(`${baseUrl}/api/v1/receivable-plans`, {
    data: {
      contractId,
      dueDate: "2026-08-26",
      paymentMethod: "TRANSFER",
      plannedAmount: 50,
    },
    headers,
  });
  const planId = identifierFrom(await planResponse.json());
  if (!planResponse.ok() || planId === null) throw new Error("Receivable-plan setup failed.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建回款", exact: true }).click();

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

  const availablePlans = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/receivable-plans/available" &&
      request.method() === "GET",
  );
  await page.getByRole("button", { name: "选择回款计划", exact: true }).click();
  expect(new URL((await availablePlans).url()).searchParams.get("contractId")).toBe(
    String(contractId),
  );
  const planDialog = page.getByRole("dialog", { name: "选择关联回款计划" });
  await expect(planDialog.getByText("第 1 期", { exact: true })).toBeVisible();
  await planDialog.getByRole("button", { name: /选\s*择/ }).click();

  await page.getByLabel("到账日期").fill("2026-07-26");
  await page.getByLabel("回款金额").fill("12.34");
  await page.getByLabel("收款方式").fill("TRANSFER");
  const receivableCreate = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/receivables" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建回款", exact: true }).click();

  const request = await receivableCreate;
  expect(request.postDataJSON()).toEqual({
    amount: 12.34,
    contractId,
    paymentMethod: "TRANSFER",
    receivablePlanId: planId,
    receivedDate: "2026-07-26",
  });
  expect((await request.response())?.ok()).toBeTruthy();
});
