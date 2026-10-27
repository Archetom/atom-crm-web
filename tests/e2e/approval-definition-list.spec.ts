import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("approval manager opens a narrow definition catalog without routing configuration", async ({
  page,
}) => {
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
    expect(route.request().method()).toBe("POST");
    expect(await route.request().postDataJSON()).toEqual({ page: 1, size: 20 });
    await route.fulfill({
      contentType: "application/json",
      json: {
        objectList: [
          {
            description: "不应显示的定义说明",
            id: 8802,
            initiatorActorIds: [9002],
            managerActorIds: [9003],
            name: "E2E 客户折扣审批",
            objectType: "CUSTOMER",
            repeatMode: "ONCE",
            status: "ACTIVE",
            steps: [
              {
                conditions: [{ fieldCode: "discount", operator: "GT", values: ["80"] }],
                memberActorIds: [9004],
                name: "财务负责人",
              },
            ],
            version: 4,
          },
        ],
        pageNum: 1,
        pageSize: 20,
        totalNum: 1,
      },
    });
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开审批定义", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "审批定义" });
  await expect(dialog.getByText("E2E 客户折扣审批", { exact: true })).toBeVisible();
  await expect(dialog.getByText("客户", { exact: true })).toBeVisible();
  await expect(dialog.getByText("已启用", { exact: true })).toBeVisible();
  await expect(dialog.getByText("9002", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("财务负责人", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("不应显示的定义说明", { exact: true })).toHaveCount(0);
});
