import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

interface VisibleMember {
  actorId: number;
  displayName: string;
}

function firstUniqueVisibleMember(value: unknown): VisibleMember | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { objectList } = value as { objectList?: unknown };
  if (!Array.isArray(objectList)) return null;

  const members = objectList.flatMap((item): VisibleMember[] => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return [];
    const { active, actorId, displayName } = item as {
      active?: unknown;
      actorId?: unknown;
      displayName?: unknown;
    };
    return active === true &&
      typeof actorId === "number" &&
      Number.isSafeInteger(actorId) &&
      actorId > 0 &&
      typeof displayName === "string" &&
      displayName.trim().length > 0
      ? [{ actorId, displayName }]
      : [];
  });
  return (
    members.find(
      (member) =>
        members.filter((candidate) => candidate.displayName === member.displayName).length === 1,
    ) ?? null
  );
}

function positiveInteger(value: unknown, key: "id" | "version", minimum: number): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= minimum
    ? candidate
    : null;
}

test("visible participant browses Work task series through the narrow recurrence projection", async ({
  page,
}) => {
  const suffix = Date.now();
  const title = `E2E Work Series ${suffix}`;
  const description = `Series description ${suffix}`;
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/task-series`, {
    data: {
      assigneeActorId: 900001,
      description,
      localTime: "09:30:00",
      recurrenceFrequency: "WEEKLY",
      recurrenceInterval: 2,
      startLocalDate: "2026-08-01",
      title,
      weekdays: ["MONDAY", "WEDNESDAY"],
      zoneId: "Asia/Shanghai",
    },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  const seriesQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/work/task-series" && request.method() === "GET",
  );
  await page.goto(`${baseUrl}/work/task-series`, { waitUntil: "networkidle" });

  expect(new URL((await seriesQuery).url()).searchParams.toString()).toBe("page=1&size=15");
  await expect(page.getByRole("heading", { name: "周期任务", exact: true })).toBeVisible();
  await expect(page.getByLabel("桌面列表").getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toHaveCount(0);
  const seriesRow = page.getByLabel("桌面列表").getByRole("row").filter({ hasText: title });
  await expect(seriesRow).toHaveCount(1);
  await expect(seriesRow.getByText("周一、周三", { exact: false })).toBeVisible();
});

test("current member creates a draft Work task series from the member directory", async ({
  page,
}) => {
  const suffix = Date.now();
  const title = `E2E Work Series Create ${suffix}`;
  const description = `Series create description ${suffix}`;
  const priority = "HIGH";
  const memberDirectoryResponse = await page.request.get(
    `${baseUrl}/api/v1/organization/members?page=1&size=50`,
    { headers },
  );
  expect(memberDirectoryResponse.ok()).toBeTruthy();
  const assignee = firstUniqueVisibleMember(await memberDirectoryResponse.json());
  expect(assignee).not.toBeNull();
  if (assignee === null) {
    throw new Error("The server-visible member directory did not return an active unique member.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/task-series`, { waitUntil: "networkidle" });
  const memberDirectoryRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/organization/members" &&
      request.method() === "GET",
  );
  await page.getByRole("button", { name: "新建周期任务", exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/work/task-series/new`);
  expect(new URL((await memberDirectoryRequest).url()).searchParams.toString()).toBe(
    "page=1&size=50",
  );

  await page.getByLabel("周期任务标题").fill(title);
  await page.getByLabel("任务描述").fill(description);
  const assigneeSelect = page.getByRole("combobox", { name: "处理人", exact: true });
  await assigneeSelect.click();
  const memberSearchResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/organization/members" &&
      response.request().method() === "GET" &&
      new URL(response.url()).searchParams.get("keyword") === assignee.displayName,
  );
  await assigneeSelect.fill(assignee.displayName);
  await memberSearchResponse;
  await assigneeSelect.press("ArrowDown");
  await assigneeSelect.press("Enter");
  const followerSelect = page.getByRole("combobox", { name: "关注人", exact: true });
  await followerSelect.click();
  const followerSearchResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/organization/members" &&
      response.request().method() === "GET" &&
      new URL(response.url()).searchParams.get("keyword") === assignee.displayName,
  );
  await followerSelect.fill(assignee.displayName);
  await followerSearchResponse;
  await followerSelect.press("ArrowDown");
  await followerSelect.press("Enter");
  await page.getByRole("combobox", { name: "优先级", exact: true }).click();
  await page.getByText("高", { exact: true }).last().click();
  await page.getByRole("checkbox", { name: "周一", exact: true }).check();
  await page.getByRole("checkbox", { name: "周三", exact: true }).check();
  await page.getByLabel("重复间隔").fill("2");
  await page.getByLabel("开始日期").fill("2026-08-01");
  await page.getByLabel("本地时间").fill("09:30");

  const createResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/work/task-series" &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await page.getByRole("button", { name: "创建草稿周期任务", exact: true }).click();
  const response = await createResponse;
  expect(response.request().postDataJSON()).toEqual({
    assigneeActorId: assignee.actorId,
    description,
    followerActorIds: [assignee.actorId],
    localTime: "09:30:00",
    priority,
    recurrenceFrequency: "WEEKLY",
    recurrenceInterval: 2,
    startLocalDate: "2026-08-01",
    title,
    weekdays: ["MONDAY", "WEDNESDAY"],
    zoneId: "Asia/Shanghai",
  });

  await expect(page).toHaveURL(`${baseUrl}/work/task-series`);
  await expect(page.getByLabel("桌面列表").getByText(title, { exact: true })).toBeVisible();
});

test("task manager explicitly stops future Work task series occurrences with the returned version", async ({
  page,
}) => {
  const title = `E2E Work Series Stop ${Date.now()}`;
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/task-series`, {
    data: {
      assigneeActorId: 900001,
      localTime: "09:30:00",
      recurrenceFrequency: "WEEKLY",
      recurrenceInterval: 2,
      startLocalDate: "2026-08-01",
      title,
      weekdays: ["MONDAY"],
      zoneId: "Asia/Shanghai",
    },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const created = await createResponse.json();
  const seriesId = positiveInteger(created, "id", 1);
  const version = positiveInteger(created, "version", 0);
  expect(seriesId).not.toBeNull();
  expect(version).not.toBeNull();
  if (seriesId === null || version === null) {
    throw new Error("Work task series did not return a stable versioned identity.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/task-series`, { waitUntil: "networkidle" });
  const seriesRow = page.getByLabel("桌面列表").getByRole("row").filter({ hasText: title });
  await expect(seriesRow).toHaveCount(1);
  await seriesRow.getByRole("button", { name: "停止未来任务", exact: true }).click();
  await expect(page.getByText("确认停止未来周期任务吗？", { exact: true })).toBeVisible();

  const deleteResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/work/task-series/${seriesId}` &&
      response.request().method() === "DELETE" &&
      response.ok(),
  );
  await page.getByRole("button", { name: "确认停止", exact: true }).click();
  expect(new URL((await deleteResponse).url()).searchParams.get("version")).toBe(String(version));
  await expect(seriesRow).toHaveCount(0);
});

test("visible participant pauses only a Work task series advertising PAUSE", async ({ page }) => {
  const seriesId = 8801;
  const title = "E2E Active Work Series Pause";
  let listReadCount = 0;
  const series = (status: "ACTIVE" | "PAUSED", version: number) => ({
    actionBlockers: [],
    allowedActions: status === "ACTIVE" ? ["PAUSE"] : ["ACTIVATE"],
    id: seriesId,
    recurrence: {
      endLocalDate: null,
      frequency: "DAILY",
      interval: 1,
      lastDayOfMonth: false,
      localTime: "09:30:00",
      monthDay: null,
      startLocalDate: "2026-08-01",
      weekdays: [],
      zoneId: "Asia/Shanghai",
    },
    status,
    title,
    version,
  });

  await page.route(/\/api\/v1\/work\/task-series(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") return route.continue();

    listReadCount += 1;
    await route.fulfill({
      contentType: "application/json",
      json: { objectList: [series(listReadCount === 1 ? "ACTIVE" : "PAUSED", listReadCount + 3)] },
    });
  });
  await page.route(`**/api/v1/work/task-series/${seriesId}/pause`, async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ version: 4 });
    await route.fulfill({
      contentType: "application/json",
      json: { allowedActions: ["ACTIVATE"], id: seriesId, status: "PAUSED", version: 5 },
    });
  });

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/task-series`, { waitUntil: "networkidle" });

  const seriesRow = page.getByLabel("桌面列表").getByRole("row").filter({ hasText: title });
  await expect(seriesRow).toHaveCount(1);
  await seriesRow.getByRole("button", { name: "暂停周期任务", exact: true }).click();
  await expect(page.getByText("确认暂停周期任务吗？", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "确认暂停", exact: true }).click();

  await expect(seriesRow.getByText("PAUSED", { exact: true })).toBeVisible();
  await expect(seriesRow.getByRole("button", { name: "暂停周期任务", exact: true })).toHaveCount(0);
  await expect(seriesRow.getByRole("button", { name: "恢复周期任务", exact: true })).toBeVisible();
});

test("task manager replaces a future Work task series reminder template from its dedicated baseline", async ({
  page,
}) => {
  const title = `E2E Work Series Reminder ${Date.now()}`;
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/task-series`, {
    data: {
      assigneeActorId: 900001,
      localTime: "09:30:00",
      recurrenceFrequency: "WEEKLY",
      recurrenceInterval: 2,
      startLocalDate: "2026-08-01",
      title,
      weekdays: ["MONDAY"],
      zoneId: "Asia/Shanghai",
    },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const created = await createResponse.json();
  const seriesId = positiveInteger(created, "id", 1);
  const version = positiveInteger(created, "version", 0);
  expect(seriesId).not.toBeNull();
  expect(version).not.toBeNull();
  if (seriesId === null || version === null) {
    throw new Error("Work task series did not return a stable versioned identity.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/task-series`, { waitUntil: "networkidle" });
  const seriesRow = page.getByLabel("桌面列表").getByRole("row").filter({ hasText: title });
  await expect(seriesRow).toHaveCount(1);
  const baselineRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/task-series/${seriesId}/reminders` &&
      request.method() === "GET",
  );
  await seriesRow.getByRole("button", { name: "管理未来提醒", exact: true }).click();
  await baselineRequest;
  const dialog = page.getByRole("dialog", { name: "管理未来提醒" });
  await expect(dialog.getByText("暂无未来提醒", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "添加提醒", exact: true }).click();

  const replaceRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/task-series/${seriesId}/reminders` &&
      request.method() === "PUT",
  );
  await dialog.getByRole("button", { name: "保存提醒", exact: true }).click();
  expect((await replaceRequest).postDataJSON()).toEqual({
    steps: [{ offsetMinutes: 0, recipientRoles: ["ASSIGNEE"], timing: "AT_DUE" }],
    version,
  });
  await expect(dialog).toHaveCount(0);
  await expect(seriesRow).toHaveCount(1);
});

test("visible participant browses immutable Work task series occurrences without task projection", async ({
  page,
}) => {
  const title = `E2E Work Series Occurrences ${Date.now()}`;
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/task-series`, {
    data: {
      assigneeActorId: 900001,
      localTime: "09:30:00",
      recurrenceFrequency: "WEEKLY",
      recurrenceInterval: 2,
      startLocalDate: "2026-08-01",
      title,
      weekdays: ["MONDAY"],
      zoneId: "Asia/Shanghai",
    },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const created = await createResponse.json();
  const seriesId = positiveInteger(created, "id", 1);
  expect(seriesId).not.toBeNull();
  if (seriesId === null) {
    throw new Error("Work task series did not return a stable identity.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/task-series`, { waitUntil: "networkidle" });
  const seriesRow = page.getByLabel("桌面列表").getByRole("row").filter({ hasText: title });
  await expect(seriesRow).toHaveCount(1);
  const occurrenceRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/task-series/${seriesId}/occurrences` &&
      request.method() === "GET",
  );
  await seriesRow.getByRole("button", { name: "查看实例", exact: true }).click();
  expect(new URL((await occurrenceRequest).url()).searchParams.toString()).toBe("page=1&size=20");
  const dialog = page.getByRole("dialog", { name: "周期实例" });
  await expect(dialog.getByText("暂无周期实例", { exact: true })).toBeVisible();
  await expect(dialog.getByText("生成任务", { exact: true })).toHaveCount(0);
});
