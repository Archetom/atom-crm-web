import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

function setDevelopmentIdentity() {
  sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
  sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
}

test("development identity bootstraps authorization, navigation, and dashboard", async ({
  page,
}) => {
  const apiHeaders = new Map<string, Record<string, string>>();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/v1/")) apiHeaders.set(path, request.headers());
  });

  await page.addInitScript(setDevelopmentIdentity);
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "CRM 仪表盘" })).toBeVisible();
  await expect(page.getByText("开发身份", { exact: true })).toBeVisible();
  await expect(page.getByText("成员 900001", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主模块导航" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开应用模块" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开导航" })).toBeHidden();
  await expect(page.locator(".ant-layout-sider")).toHaveCount(0);
  await expect
    .poll(() => [...apiHeaders.keys()].sort())
    .toEqual([
      "/api/v1/approvals/pending-count",
      "/api/v1/authorization/me",
      "/api/v1/dashboard/overview",
      "/api/v1/dashboard/preferences",
      "/api/v1/navigation",
      "/api/v1/organization/tenants",
    ]);

  for (const headers of apiHeaders.values()) {
    expect(headers["x-dev-user-id"]).toBe("900001");
    expect(headers["x-dev-tenant-id"]).toBe("900001");
  }
});

test("without a session the development build requires the identity page", async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "开发身份" })).toBeVisible();
  await expect(page.getByText("不得填入真实生产身份")).toBeVisible();
});

test("server-authorized development identity can enter tenant access directly", async ({
  page,
}) => {
  await page.addInitScript(setDevelopmentIdentity);
  await page.goto(`${baseUrl}/organization/tenants`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "租户访问" })).toBeVisible();
  await expect(page.getByText("已授权租户", { exact: true })).toBeVisible();
  await expect(page.getByText("开发租户切换", { exact: true })).toBeVisible();
  await expect(page.getByText("没有页面访问权限", { exact: true })).toBeHidden();
});

test.describe("mobile shell", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("uses a drawer trigger instead of the desktop sider", async ({ page }) => {
    await page.addInitScript(setDevelopmentIdentity);
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "CRM 仪表盘" })).toBeVisible();
    await expect(page.locator(".ant-layout-sider")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "打开导航" })).toBeVisible();
  });
});
