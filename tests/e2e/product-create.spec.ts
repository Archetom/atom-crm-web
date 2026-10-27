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

test("product creation redirects to the server-returned detail record", async ({ page }) => {
  const suffix = Date.now();
  const productName = `E2E Created Product ${suffix}`;

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/products/new`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "新建产品" })).toBeVisible();
  await page.getByLabel("产品名称").fill(productName);
  await page.getByLabel("产品编码").fill(`E2E-CREATED-${suffix}`);
  await page.getByLabel("目录价").fill("12.5");
  await page.getByRole("button", { name: "创建产品" }).click();

  await expect(page).toHaveURL(/\/crm\/products\/\d+$/);
  await expect(page.getByRole("heading", { name: productName, exact: true })).toBeVisible();
});

test("product creation sends only an explicitly selected server-visible owner", async ({
  page,
}) => {
  const suffix = Date.now();
  const assigneeActorId = 900061;
  const assigneeTenantId = 900062;
  const assigneeName = "E2E Product Create Owner";
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

  const productName = `E2E Product Owner ${suffix}`;
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/products/new`, { waitUntil: "networkidle" });
  await page.getByLabel("产品名称").fill(productName);
  await page.getByLabel("产品编码").fill(`E2E-PRODUCT-OWNER-${suffix}`);
  await page.getByLabel("目录价").fill("49.9");
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
      new URL(request.url()).pathname === "/api/v1/products" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建产品" }).click();

  expect((await createRequest).postDataJSON()).toMatchObject({
    name: productName,
    ownerActorId: assigneeActorId,
  });
  await expect(page).toHaveURL(/\/crm\/products\/\d+$/);
});
