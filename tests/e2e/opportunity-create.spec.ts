import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function identifierFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { id } = value as { id?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

test("opportunity creation selects server-visible customer, pipeline, and stage", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Opportunity Customer ${suffix}`;
  const opportunityName = `E2E Created Opportunity ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/opportunities/new`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "新建商机" })).toBeVisible();
  await page.getByLabel("商机名称").fill(opportunityName);
  await page.getByRole("button", { name: "选择客户" }).click();
  const customerDialog = page.getByRole("dialog", { name: "选择关联客户" });
  await customerDialog.getByPlaceholder("搜索可见客户").fill(customerName);
  await customerDialog.getByPlaceholder("搜索可见客户").press("Enter");
  await customerDialog.getByRole("button", { name: "选择" }).click();
  await expect(customerDialog).toBeHidden();

  const pipelineSelect = page.getByLabel("销售管线");
  await pipelineSelect.click();
  await pipelineSelect.press("ArrowDown");
  await pipelineSelect.press("Enter");
  await expect(page.getByLabel("销售阶段")).toBeEnabled();
  const stageSelect = page.getByLabel("销售阶段");
  await stageSelect.click();
  await stageSelect.press("ArrowDown");
  await stageSelect.press("Enter");
  await page.getByRole("button", { name: "创建商机" }).click();

  await expect(page).toHaveURL(/\/crm\/opportunities\/\d+$/);
  await expect(page.getByRole("heading", { name: opportunityName, exact: true })).toBeVisible();
});

test("opportunity creation sends only an explicitly selected server-visible owner", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Opportunity Owner Customer ${suffix}`;
  const opportunityName = `E2E Opportunity Owner ${suffix}`;
  const assigneeActorId = 900071;
  const assigneeTenantId = 900072;
  const assigneeName = "E2E Opportunity Create Owner";
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
      { headers },
    );
    expect(approvalResponse.ok()).toBeTruthy();
  } else {
    expect(membershipResponse.status()).toBe(409);
  }
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/opportunities/new`, { waitUntil: "networkidle" });
  await page.getByLabel("商机名称").fill(opportunityName);
  await page.getByRole("button", { name: "选择客户" }).click();
  const customerDialog = page.getByRole("dialog", { name: "选择关联客户" });
  await customerDialog.getByPlaceholder("搜索可见客户").fill(customerName);
  await customerDialog.getByPlaceholder("搜索可见客户").press("Enter");
  await customerDialog.getByRole("button", { name: "选择" }).click();
  await expect(customerDialog).toBeHidden();
  const pipelineSelect = page.getByLabel("销售管线");
  await pipelineSelect.click();
  await pipelineSelect.press("ArrowDown");
  await pipelineSelect.press("Enter");
  const stageSelect = page.getByLabel("销售阶段");
  await expect(stageSelect).toBeEnabled();
  await stageSelect.click();
  await stageSelect.press("ArrowDown");
  await stageSelect.press("Enter");
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
      new URL(request.url()).pathname === "/api/v1/opportunities" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建商机" }).click();

  expect((await createRequest).postDataJSON()).toMatchObject({
    name: opportunityName,
    ownerActorId: assigneeActorId,
  });
  await expect(page).toHaveURL(/\/crm\/opportunities\/\d+$/);
});

test("opportunity creation sends only contacts selected from its current customer", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Opportunity Contact Customer ${suffix}`;
  const opportunityName = `E2E Opportunity Contact ${suffix}`;
  const contactName = `E2E Opportunity Contact Person ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) {
    throw new Error("Customer did not return an ID.");
  }
  const contactResponse = await page.request.post(`${baseUrl}/api/v1/contacts`, {
    data: { customerId, name: contactName },
    headers,
  });
  expect(contactResponse.ok()).toBeTruthy();
  const contactId = identifierFrom(await contactResponse.json());
  expect(contactId).not.toBeNull();
  if (contactId === null) {
    throw new Error("Contact did not return an ID.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/opportunities/new`, { waitUntil: "networkidle" });
  await page.getByLabel("商机名称").fill(opportunityName);
  await page.getByRole("button", { name: "选择客户" }).click();
  const customerDialog = page.getByRole("dialog", { name: "选择关联客户" });
  await customerDialog.getByPlaceholder("搜索可见客户").fill(customerName);
  await customerDialog.getByPlaceholder("搜索可见客户").press("Enter");
  await customerDialog.getByRole("button", { name: "选择" }).click();
  await expect(customerDialog).toBeHidden();

  await page.getByRole("button", { name: "选择联系人" }).click();
  const contactDialog = page.getByRole("dialog", { name: "选择关联联系人" });
  await contactDialog.getByPlaceholder("按联系人姓名搜索").fill(contactName);
  await contactDialog.getByPlaceholder("按联系人姓名搜索").press("Enter");
  await contactDialog.getByRole("button", { name: "选择" }).click();
  await contactDialog.getByRole("button", { name: /完\s*成/ }).click();
  await expect(contactDialog).toBeHidden();

  const primaryContactSelect = page.getByLabel("首要联系人");
  await primaryContactSelect.click();
  await page.getByText(contactName, { exact: true }).last().click();
  const pipelineSelect = page.getByLabel("销售管线");
  await pipelineSelect.click();
  await pipelineSelect.press("ArrowDown");
  await pipelineSelect.press("Enter");
  const stageSelect = page.getByLabel("销售阶段");
  await expect(stageSelect).toBeEnabled();
  await stageSelect.click();
  await stageSelect.press("ArrowDown");
  await stageSelect.press("Enter");

  const createRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/opportunities" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建商机" }).click();

  expect((await createRequest).postDataJSON()).toMatchObject({
    contactIds: [contactId],
    customerId,
    primaryContactId: contactId,
  });
  await expect(page).toHaveURL(/\/crm\/opportunities\/\d+$/);
});
