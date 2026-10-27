import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("current member reads a narrow Work notification inbox and marks an item read", async ({
  page,
}) => {
  const notificationId = 8801;
  const title = "E2E 提交周报";
  let read = false;
  const notification = () => ({
    dueTime: "2026-08-01T09:30:00",
    id: notificationId,
    kind: "WORK_TASK_REMINDER",
    priority: "HIGH",
    status: read ? "READ" : "UNREAD",
    taskId: 9001,
    title,
  });
  await page.route(/\/api\/v1\/notifications(?:\?.*)?$/, async (route) => {
    expect(route.request().method()).toBe("GET");
    expect(new URL(route.request().url()).searchParams.toString()).toBe(
      "page=1&size=20&unreadOnly=false",
    );
    await route.fulfill({
      contentType: "application/json",
      json: { objectList: [notification()], pageNum: 1, pageSize: 20, totalNum: 1 },
    });
  });
  await page.route(`**/api/v1/notifications/${notificationId}/read`, async (route) => {
    expect(route.request().method()).toBe("POST");
    read = true;
    await route.fulfill({ contentType: "application/json", json: notification() });
  });

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开通知中心", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "通知中心" });
  await expect(dialog.getByText(title, { exact: true })).toBeVisible();
  await expect(dialog.getByText("9001", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "标为已读", exact: true }).click();
  await expect(dialog.getByText("已读", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "标为已读", exact: true })).toHaveCount(0);
});
