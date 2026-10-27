import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("approval manager enables a definition from its narrow status baseline", async ({ page }) => {
  await page.route("**/api/v1/authorization/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        actorId: 900001,
        authorities: ["navigation:read", "approvals:manage"],
        dataScopes: {},
        roles: [],
      },
    });
  });
  await page.route("**/api/v1/navigation", async (route) => {
    await route.fulfill({ contentType: "application/json", json: [] });
  });
  await page.route("**/api/v1/dashboard/overview", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        asOfDate: "2026-07-26",
        cards: [],
        from: "2026-07-01",
        granularity: "DAY",
        preferredDataScope: "SELF",
        timeRange: "MONTH",
        to: "2026-07-26",
      },
    });
  });
  await page.route("**/api/v1/approval-definitions/query", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        objectList: [
          {
            id: 8802,
            name: "E2E 客户折扣审批",
            objectType: "CUSTOMER",
            status: "INACTIVE",
            steps: [{ memberActorIds: [9002], name: "保密审批步骤" }],
            version: 4,
          },
        ],
        pageNum: 1,
        pageSize: 20,
        totalNum: 1,
      },
    });
  });
  await page.route("**/api/v1/approval-definitions/8802", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({
      contentType: "application/json",
      json: {
        description: "不应显示的定义说明",
        id: 8802,
        managerActorIds: [9003],
        name: "E2E 客户折扣审批",
        objectType: "CUSTOMER",
        repeatMode: "ONCE",
        status: "INACTIVE",
        steps: [{ conditions: [{ fieldCode: "discount", values: ["80"] }], name: "保密审批步骤" }],
        version: 4,
      },
    });
  });
  await page.route("**/api/v1/approval-definitions/8802/status", async (route) => {
    expect(route.request().method()).toBe("PUT");
    expect(await route.request().postDataJSON()).toEqual({ status: "ACTIVE", version: 4 });
    await route.fulfill({
      contentType: "application/json",
      json: { id: 8802, status: "ACTIVE", version: 5 },
    });
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开审批定义", exact: true }).click();

  const list = page.getByRole("dialog", { name: "审批定义" });
  await list.getByRole("button", { name: "管理状态", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "管理审批定义状态" });
  await expect(dialog.getByText("未启用", { exact: true })).toBeVisible();
  await expect(dialog.getByText("9003", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("保密审批步骤", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("不应显示的定义说明", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "启用定义", exact: true }).click();
  await page.getByRole("button", { name: "确认启用", exact: true }).click();

  await expect(dialog).toHaveCount(0);
});
