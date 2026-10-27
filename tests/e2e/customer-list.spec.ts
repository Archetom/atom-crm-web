import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

test("customer list keeps a flat, one-based query in the URL and API request", async ({ page }) => {
  let customerRequest: { body: unknown; method: string; url: string } | null = null;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/customers/query") {
      customerRequest = {
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

  await page.goto(`${baseUrl}/crm/customers?page=2&size=50&keyword=Acme`, {
    waitUntil: "networkidle",
  });

  await expect(page.getByRole("heading", { level: 1, name: "客户管理" })).toBeVisible();
  await expect(page.getByPlaceholder("搜索客户名称或关键词")).toHaveValue("Acme");
  await expect.poll(() => customerRequest?.url).toBe(`${baseUrl}/api/v1/customers/query`);
  expect(customerRequest?.method).toBe("POST");
  expect(customerRequest?.body).toEqual({ keyword: "Acme", page: 2, size: 50 });
});

test("customer list retains its critical commands at desktop, tablet, and mobile widths", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers`, { waitUntil: "networkidle" });

  for (const width of [1280, 768] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { level: 1, name: "客户管理" })).toBeVisible();
    await expect(page.getByRole("button", { name: "附近客户" })).toBeVisible();
    expect(
      await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("button", { name: "更多客户操作" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建客户" })).toBeVisible();
  expect(
    await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});

test("customer list checks duplicates from its toolbar without changing list context", async ({
  page,
}) => {
  const name = `E2E Customer List Duplicate ${Date.now()}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers?page=2&size=15&keyword=existing`, {
    waitUntil: "networkidle",
  });

  const duplicateCheckButton = page.getByRole("button", { name: "查重" });
  await expect(duplicateCheckButton).toBeVisible();
  await duplicateCheckButton.click();

  const duplicateDialog = page.getByRole("dialog", { name: "客户查重" });
  await expect(duplicateDialog.getByLabel("客户名称")).toBeVisible();
  await duplicateDialog.getByLabel("客户名称").fill(name);

  const checkRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/customers/duplicate-check" &&
      request.method() === "POST",
  );
  await duplicateDialog.getByRole("button", { name: /查\s*重/ }).click();
  expect((await checkRequest).postDataJSON()).toMatchObject({ name });
  await expect(duplicateDialog.getByText("发现当前可见范围内存在重复客户。")).toBeVisible();

  await duplicateDialog.getByRole("button", { name: /取\s*消/ }).click();
  await expect(duplicateDialog).toBeHidden();
  await expect(page).toHaveURL(`${baseUrl}/crm/customers?page=2&size=15&keyword=existing`);
});
