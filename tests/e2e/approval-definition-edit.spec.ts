import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("approval manager replaces only a verified inactive minimal template", async ({ page }) => {
  const baseline = {
    id: 8802,
    initiatorActorIds: [],
    initiatorDepartmentIds: [],
    managerActorIds: [9003],
    name: "E2E 客户折扣审批",
    objectType: "CUSTOMER",
    repeatMode: "ONCE",
    status: "INACTIVE",
    steps: [
      {
        code: "step-1",
        conditions: [],
        fallback: "MANAGERS",
        memberActorIds: [9002],
        mode: "ANY",
        name: "保密审批步骤",
        order: 0,
        roleIds: [],
        type: "MEMBER",
      },
    ],
    version: 4,
  };
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
    await route.fulfill({
      contentType: "application/json",
      json: { objectList: [baseline], pageNum: 1, pageSize: 20, totalNum: 1 },
    });
  });
  await page.route("**/api/v1/organization/members?**", async (route) => {
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
  await page.route("**/api/v1/approval-definitions/8802", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", json: baseline });
      return;
    }
    expect(route.request().method()).toBe("PUT");
    expect(await route.request().postDataJSON()).toEqual({
      managerActorIds: [9003],
      name: "更新后的审批定义",
      objectType: "CUSTOMER",
      repeatMode: "ONCE",
      steps: [
        {
          code: "step-1",
          fallback: "MANAGERS",
          memberActorIds: [9002],
          mode: "ANY",
          name: "保密审批步骤",
          order: 0,
          type: "MEMBER",
        },
      ],
      version: 4,
    });
    await route.fulfill({
      contentType: "application/json",
      json: { ...baseline, name: "更新后的审批定义", version: 5 },
    });
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开审批定义", exact: true }).click();
  const list = page.getByRole("dialog", { name: "审批定义" });
  await list.getByRole("button", { name: "编辑最小模板", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "编辑最小审批模板" });
  await dialog.getByLabel("定义名称").fill("更新后的审批定义");
  await expect(dialog.getByText("9003", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("保密审批步骤", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "保存最小模板", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
