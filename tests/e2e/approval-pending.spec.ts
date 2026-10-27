import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("current member opens a narrow pending approval inbox without approval facts", async ({
  page,
}) => {
  await page.route("**/api/v1/authorization/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        actorId: 900001,
        authorities: ["navigation:read", "approvals:read"],
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
  await page.route("**/api/v1/approvals/query", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(await route.request().postDataJSON()).toEqual({ bucket: "PENDING", page: 1, size: 20 });
    await route.fulfill({
      contentType: "application/json",
      json: {
        objectList: [
          {
            applicantActorId: 9002,
            allowedActions: ["APPROVE", "REJECT"],
            facts: { discount: ["保密折扣"] },
            id: 8802,
            objectType: "CUSTOMER",
            status: "PENDING",
            subjectId: 9001,
            title: "E2E 审批客户折扣",
            version: 4,
          },
        ],
        pageNum: 1,
        pageSize: 20,
        totalNum: 1,
      },
    });
  });
  await page.route("**/api/v1/approvals/8802", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({
      contentType: "application/json",
      json: {
        applicantActorId: 9002,
        allowedActions: ["APPROVE", "REJECT", "TRANSFER"],
        facts: { discount: ["保密折扣"] },
        id: 8802,
        status: "PENDING",
        tasks: [
          {
            actedTime: "2026-07-26T10:00:00",
            assignedActorId: 9003,
            remark: "保密审批意见",
            status: "APPROVED",
            stepName: "直属负责人",
            stepOrder: 1,
            taskKey: "task-1",
          },
          {
            actedTime: null,
            assignedActorId: 9004,
            remark: null,
            status: "PENDING",
            stepName: "财务负责人",
            stepOrder: 2,
            taskKey: "task-2",
          },
        ],
        title: "E2E 审批客户折扣",
        version: 4,
      },
    });
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^打开审批待办/u }).click();

  const dialog = page.getByRole("dialog", { name: "审批待办" });
  await expect(dialog.getByText("E2E 审批客户折扣", { exact: true })).toBeVisible();
  await expect(dialog.getByText("待审批", { exact: true })).toBeVisible();
  await expect(dialog.getByText("9001", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("保密折扣", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "查看详情", exact: true }).click();

  const detail = page.getByRole("dialog", { name: "审批详情" });
  await expect(detail.getByText("第 1 步：直属负责人", { exact: true })).toBeVisible();
  await expect(detail.getByText("第 2 步：财务负责人", { exact: true })).toBeVisible();
  await expect(detail.getByText("9003", { exact: true })).toHaveCount(0);
  await expect(detail.getByText("保密审批意见", { exact: true })).toHaveCount(0);
});
