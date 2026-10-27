import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("customer creation can continue directly into a server-confirmed contact creation", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Customer Contact Flow ${suffix}`;
  const contactName = `E2E Customer Contact ${suffix}`;
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });

  await page.goto(`${baseUrl}/crm/customers/new`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("请输入客户名称").fill(customerName);
  const customerRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/customers" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建并新建联系人" }).click();
  expect((await customerRequest).postDataJSON()).toMatchObject({ name: customerName });

  await expect(page).toHaveURL(/\/crm\/contacts\/new\?customerId=\d+&returnTo=/);
  await expect(page.getByRole("heading", { name: "新建联系人", exact: true })).toBeVisible();
  await expect(page.getByText(`将关联到客户：${customerName}`, { exact: true })).toBeVisible();
  await page.getByPlaceholder("请输入联系人姓名").fill(contactName);
  const contactRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contacts" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建联系人" }).click();

  const payload = (await contactRequest).postDataJSON() as Record<string, unknown>;
  expect(payload).toMatchObject({ name: contactName, customerId: expect.any(Number) });
  await expect(page).toHaveURL(/\/crm\/contacts\/\d+$/);
});
