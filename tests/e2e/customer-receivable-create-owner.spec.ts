import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const ownerHeaders = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function identifierFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { id } = value as { id?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

test("customer receivable creation sends only an explicitly selected server-visible owner", async ({
  page,
}) => {
  const suffix = Date.now();
  const assigneeActorId = 900091;
  const assigneeTenantId = 900092;
  const assigneeName = "E2E Receivable Create Owner";
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
    const membershipRequestId = identifierFrom(await membershipResponse.json());
    expect(membershipRequestId).not.toBeNull();
    if (membershipRequestId === null) {
      throw new Error("Membership request did not return an ID.");
    }
    const approvalResponse = await page.request.post(
      `${baseUrl}/api/v1/organization/membership-requests/${membershipRequestId}/approve`,
      { headers: ownerHeaders },
    );
    expect(approvalResponse.ok()).toBeTruthy();
  } else {
    expect(membershipResponse.status()).toBe(409);
  }
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Receivable Owner Customer ${suffix}` },
    headers: ownerHeaders,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) {
    throw new Error("Customer did not return an ID.");
  }
  const productResponse = await page.request.post(`${baseUrl}/api/v1/products`, {
    data: {
      code: `E2E-RECEIVABLE-OWNER-P-${suffix}`,
      listPrice: 100,
      name: `E2E Receivable Owner Product ${suffix}`,
    },
    headers: ownerHeaders,
  });
  expect(productResponse.ok()).toBeTruthy();
  const productId = identifierFrom(await productResponse.json());
  expect(productId).not.toBeNull();
  if (productId === null) {
    throw new Error("Product did not return an ID.");
  }
  const contractNumber = `E2E-RECEIVABLE-OWNER-${suffix}`;
  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: {
      customerId,
      name: `E2E Receivable Owner Contract ${suffix}`,
      number: contractNumber,
      products: [{ productId, quantity: 1 }],
    },
    headers: ownerHeaders,
  });
  expect(contractResponse.ok()).toBeTruthy();
  const contractId = identifierFrom(await contractResponse.json());
  expect(contractId).not.toBeNull();
  if (contractId === null) {
    throw new Error("Contract did not return an ID.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/receivables/new`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "选择合同" }).click();
  const contractDialog = page.getByRole("dialog", { name: "选择关联合同" });
  await contractDialog.getByPlaceholder("按合同名称或编号搜索").fill(contractNumber);
  await contractDialog.getByRole("button", { name: /选\s*择/ }).click();
  await expect(contractDialog).toBeHidden();
  await page.getByLabel("到账日期").fill("2026-08-09");
  await page.getByLabel("回款金额").fill("12.34");
  await page.getByLabel("收款方式").fill("TRANSFER");
  const ownerSelect = page.getByLabel("负责人");
  await expect(ownerSelect).toBeVisible();
  await ownerSelect.click();
  const ownerDirectoryResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/organization/members" &&
      response.request().method() === "GET" &&
      new URL(response.url()).searchParams.get("keyword") === assigneeName,
  );
  await ownerSelect.fill(assigneeName);
  await ownerDirectoryResponse;
  await page.getByText(assigneeName, { exact: true }).last().click();

  const createRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/receivables" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建回款" }).click();

  expect((await createRequest).postDataJSON()).toMatchObject({
    contractId,
    ownerActorId: assigneeActorId,
  });
  await expect(page).toHaveURL(new RegExp(`/crm/customers/${customerId}/receivables/\\d+$`));
});
