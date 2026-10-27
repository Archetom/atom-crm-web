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

test("customer detail enters a server-scoped invoice-profile list without a navigation entry", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Invoice Profile Customer ${suffix}`;
  const invoiceTitle = `E2E Invoice Title ${suffix}`;
  const taxNumber = `91310000${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const profileResponse = await page.request.post(`${baseUrl}/api/v1/invoice-profiles`, {
    data: {
      customerId,
      taxNumber,
      title: invoiceTitle,
      titleType: "ORGANIZATION",
    },
    headers,
  });
  expect(profileResponse.ok()).toBeTruthy();

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  const profilesRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/invoice-profiles" && request.method() === "GET",
  );
  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "查看开票资料" }).click();

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/invoice-profiles`);
  await expect(page.getByRole("heading", { name: "开票资料", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: new RegExp(invoiceTitle) })).toBeVisible();
  await expect(page.getByText(new RegExp(`税号 ${taxNumber}`))).toBeVisible();
  expect(new URL((await profilesRequest).url()).searchParams.get("customerId")).toBe(
    String(customerId),
  );
});

test("customer-context invoice-profile creation submits only the personal-title request", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Invoice Profile Create Customer ${suffix}`;
  const invoiceTitle = `E2E Personal Invoice Title ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/invoice-profiles`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "新建个人抬头" }).click();
  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/invoice-profiles/new`);

  const createRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/invoice-profiles" && request.method() === "POST",
  );
  await page.getByLabel("开票抬头").fill(invoiceTitle);
  await page.getByRole("button", { name: "创建个人抬头" }).click();
  expect((await createRequest).postDataJSON()).toEqual({
    customerId,
    title: invoiceTitle,
    titleType: "INDIVIDUAL",
  });

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/invoice-profiles`);
  await expect(page.getByRole("heading", { name: new RegExp(invoiceTitle) })).toBeVisible();
});

test("customer-context personal invoice-profile editing submits only the new title and version", async ({
  page,
}) => {
  const suffix = Date.now();
  const originalTitle = `E2E Editable Invoice Title ${suffix}`;
  const updatedTitle = `E2E Updated Invoice Title ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Invoice Profile Edit Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const profileResponse = await page.request.post(`${baseUrl}/api/v1/invoice-profiles`, {
    data: { customerId, title: originalTitle, titleType: "INDIVIDUAL" },
    headers,
  });
  expect(profileResponse.ok()).toBeTruthy();
  const profile = await profileResponse.json();
  const profileId = identifierFrom(profile);
  const version =
    profile !== null && typeof profile === "object" && !Array.isArray(profile)
      ? (profile as { version?: unknown }).version
      : null;
  expect(profileId).not.toBeNull();
  expect(typeof version).toBe("number");
  if (
    profileId === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    throw new Error("Invoice profile did not return an ID and version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/invoice-profiles`, {
    waitUntil: "networkidle",
  });
  const profileItem = page.getByRole("listitem").filter({ hasText: originalTitle });
  await profileItem.getByRole("button", { name: "编辑个人抬头" }).click();
  const dialog = page.getByRole("dialog", { name: "编辑个人抬头" });
  await dialog.getByLabel("开票抬头").fill(updatedTitle);
  const updateRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/invoice-profiles/${profileId}` &&
      request.method() === "PATCH",
  );
  await dialog.getByRole("button", { name: "保存修改" }).click();
  expect((await updateRequest).postDataJSON()).toEqual({ title: updatedTitle, version });
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: new RegExp(updatedTitle) })).toBeVisible();
});

test("customer-context invoice-profile deletion uses the returned version after confirmation", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Invoice Profile Delete Customer ${suffix}`;
  const invoiceTitle = `E2E Deletable Invoice Title ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const profileResponse = await page.request.post(`${baseUrl}/api/v1/invoice-profiles`, {
    data: { customerId, title: invoiceTitle, titleType: "INDIVIDUAL" },
    headers,
  });
  expect(profileResponse.ok()).toBeTruthy();
  const profile = await profileResponse.json();
  if (profile === null || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("Invoice profile did not return an object.");
  }
  const { version } = profile as { version?: unknown };
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
    throw new Error("Invoice profile did not return a version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/invoice-profiles`, {
    waitUntil: "networkidle",
  });
  const profileItem = page.getByRole("listitem").filter({ hasText: invoiceTitle });
  await profileItem.getByRole("button", { name: "删除" }).click();
  const deleteRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname.startsWith("/api/v1/invoice-profiles/") &&
      request.method() === "DELETE",
  );
  await page.getByRole("button", { name: "确认删除" }).click();
  expect(new URL((await deleteRequest).url()).searchParams.get("version")).toBe(String(version));
  await expect(profileItem).toBeHidden();
});
