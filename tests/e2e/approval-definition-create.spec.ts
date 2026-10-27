import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("approval manager creates a narrow inactive definition draft from visible members", async ({
  page,
}) => {
  await page.route("**/api/v1/authorization/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        actorId: 900001,
        authorities: ["navigation:read", "approvals:manage", "organization:read"],
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
    await route.fulfill({
      contentType: "application/json",
      json: { objectList: [], pageNum: 1, pageSize: 20, totalNum: 0 },
    });
  });
  await page.route("**/api/v1/organization/members?**", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({
      contentType: "application/json",
      json: {
        objectList: [
          { active: true, actorId: 9002, displayName: "E2E 审批成员" },
          { active: true, actorId: 9003, displayName: "E2E 审批管理员" },
        ],
      },
    });
  });
  await page.route("**/api/v1/approval-definitions", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(await route.request().postDataJSON()).toEqual({
      managerActorIds: [9003],
      name: "E2E 客户折扣审批",
      objectType: "CUSTOMER",
      repeatMode: "ONCE",
      steps: [
        {
          code: "step-1",
          fallback: "MANAGERS",
          memberActorIds: [9002],
          mode: "ANY",
          name: "审批成员",
          order: 0,
          type: "MEMBER",
        },
      ],
    });
    await route.fulfill({
      contentType: "application/json",
      json: {
        id: 8802,
        managerActorIds: [9003],
        name: "E2E 客户折扣审批",
        objectType: "CUSTOMER",
        repeatMode: "ONCE",
        status: "INACTIVE",
        steps: [{ memberActorIds: [9002], name: "审批成员" }],
        version: 0,
      },
    });
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开审批定义", exact: true }).click();
  await page.getByRole("button", { name: "新建审批定义", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "新建停用审批定义" });
  await dialog.getByLabel("定义名称").fill("E2E 客户折扣审批");
  await dialog.getByRole("combobox", { name: "审批成员", exact: true }).click();
  await page.getByText("E2E 审批成员", { exact: true }).last().click();
  await page.keyboard.press("Escape");
  await dialog.getByRole("combobox", { name: "审批管理员", exact: true }).click();
  await page.getByText("E2E 审批管理员", { exact: true }).last().click();
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "创建停用审批定义", exact: true }).click();

  await expect(dialog).toHaveCount(0);
});
