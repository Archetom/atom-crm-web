import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function identifierFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { id } = value as { id?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function versionFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { version } = value as { version?: unknown };
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0
    ? version
    : null;
}

interface VisibleMember {
  actorId: number;
  displayName: string;
}

function firstUniqueVisibleMember(value: unknown, excludedActorId?: number): VisibleMember | null {
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
        member.actorId !== excludedActorId &&
        members.filter((candidate) => candidate.displayName === member.displayName).length === 1,
    ) ?? null
  );
}

test("current member creates a Work task from the server-visible member directory", async ({
  page,
}) => {
  const suffix = Date.now();
  const title = `E2E Work Create ${suffix}`;
  const description = `Create task description ${suffix}`;
  const priority = "HIGH";
  const dueTime = "2026-07-30T09:00";
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
  await page.goto(`${baseUrl}/work/tasks`, { waitUntil: "networkidle" });
  const memberDirectoryRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/organization/members" &&
      request.method() === "GET",
  );
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/work/tasks/new`);
  expect(new URL((await memberDirectoryRequest).url()).searchParams.toString()).toBe(
    "page=1&size=50",
  );

  await page.getByLabel("任务标题").fill(title);
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
  await page.getByLabel("到期时间").fill(dueTime);

  const createResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/work/tasks" &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await page.getByRole("button", { name: "创建任务", exact: true }).click();
  const response = await createResponse;
  expect(response.request().postDataJSON()).toEqual({
    assigneeActorId: assignee.actorId,
    description,
    dueTime,
    followerActorIds: [assignee.actorId],
    priority,
    title,
  });
  const taskId = identifierFrom(await response.json());
  expect(taskId).not.toBeNull();
  if (taskId === null) throw new Error("Work task did not return an ID.");

  await expect(page).toHaveURL(`${baseUrl}/work/tasks/${taskId}`);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
});

test("current member creates a Work task with an explicitly linked writable customer", async ({
  page,
}) => {
  const suffix = Date.now();
  const title = `E2E Work Customer Link ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Work Link Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");
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
  await page.goto(`${baseUrl}/work/tasks/new`, { waitUntil: "networkidle" });
  await page.getByLabel("任务标题").fill(title);
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
  await page.getByRole("combobox", { name: "关联业务类型", exact: true }).click();
  await page.getByText("客户", { exact: true }).last().click();
  await page.getByLabel("关联业务记录 ID").fill(String(customerId));

  const createResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/work/tasks" &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await page.getByRole("button", { name: "创建任务", exact: true }).click();
  expect((await createResponse).request().postDataJSON()).toMatchObject({
    assigneeActorId: assignee.actorId,
    businessObjectType: "CUSTOMER",
    businessRecordId: customerId,
    title,
  });
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(`客户 #${customerId}`, { exact: true })).toBeVisible();
});

test("task manager edits an open task from its versioned structure baseline", async ({ page }) => {
  const suffix = Date.now();
  const title = `E2E Work Edit ${suffix}`;
  const description = `Initial task description ${suffix}`;
  const updatedTitle = `E2E Work Edited ${suffix}`;
  const updatedDescription = `Updated task description ${suffix}`;
  const updatedDueTime = "2026-07-31T09:00";
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/tasks`, {
    data: {
      assigneeActorId: 900001,
      description,
      dueTime: "2026-07-30T09:00:00",
      priority: "NORMAL",
      title,
    },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const createdTask = await createResponse.json();
  const taskId = identifierFrom(createdTask);
  const version = versionFrom(createdTask);
  expect(taskId).not.toBeNull();
  expect(version).not.toBeNull();
  if (taskId === null || version === null) {
    throw new Error("Work task did not return a stable identity and version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/tasks/${taskId}`, { waitUntil: "networkidle" });
  await expect(page.getByText(description, { exact: true })).toHaveCount(0);

  const baselineRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}` &&
      request.method() === "GET",
  );
  await page.getByRole("button", { name: "编辑任务", exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/work/tasks/${taskId}/edit`);
  await baselineRequest;
  await expect(page.getByLabel("任务描述")).toHaveValue(description);

  await page.getByLabel("任务标题").fill(updatedTitle);
  await page.getByLabel("任务描述").fill(updatedDescription);
  await page.getByLabel("到期时间").fill(updatedDueTime);
  const updateRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}` &&
      request.method() === "PUT",
  );
  await page.getByRole("button", { name: "保存任务", exact: true }).click();
  expect((await updateRequest).postDataJSON()).toEqual({
    description: updatedDescription,
    dueTime: updatedDueTime,
    priority: "NORMAL",
    title: updatedTitle,
    version,
  });
  await expect(page).toHaveURL(`${baseUrl}/work/tasks/${taskId}`);
  await expect(page.getByRole("heading", { name: updatedTitle, exact: true })).toBeVisible();
  await expect(page.getByText(updatedDescription, { exact: true })).toHaveCount(0);
});

test("task manager reassigns an open task to a server-visible member with its current version", async ({
  page,
}) => {
  const suffix = Date.now();
  const title = `E2E Work Reassign ${suffix}`;
  const memberDirectoryResponse = await page.request.get(
    `${baseUrl}/api/v1/organization/members?page=1&size=50`,
    { headers },
  );
  expect(memberDirectoryResponse.ok()).toBeTruthy();
  const assignee = firstUniqueVisibleMember(await memberDirectoryResponse.json(), 900001);
  expect(assignee).not.toBeNull();
  if (assignee === null) {
    throw new Error("The server-visible member directory did not return another active member.");
  }

  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/tasks`, {
    data: { assigneeActorId: 900001, title },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const createdTask = await createResponse.json();
  const taskId = identifierFrom(createdTask);
  const version = versionFrom(createdTask);
  expect(taskId).not.toBeNull();
  expect(version).not.toBeNull();
  if (taskId === null || version === null) {
    throw new Error("Work task did not return a stable identity and version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/tasks/${taskId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "重新分配处理人", exact: true }).click();

  const assigneeSearch = page.getByRole("searchbox", { name: "按成员姓名搜索", exact: true });
  const memberSearchResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/organization/members" &&
      response.request().method() === "GET" &&
      new URL(response.url()).searchParams.get("keyword") === assignee.displayName,
  );
  await assigneeSearch.fill(assignee.displayName);
  await assigneeSearch.press("Enter");
  await memberSearchResponse;

  const reassignRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}/assignee` &&
      request.method() === "PUT",
  );
  await page
    .getByRole("listitem")
    .filter({ hasText: assignee.displayName })
    .getByRole("button", { name: "重新分配", exact: true })
    .click();
  expect((await reassignRequest).postDataJSON()).toEqual({
    assigneeActorId: assignee.actorId,
    version,
  });
  await expect(page.getByRole("dialog", { name: "重新分配处理人" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
});

test("task manager replaces the complete follower baseline with server-visible members", async ({
  page,
}) => {
  const suffix = Date.now();
  const title = `E2E Work Followers ${suffix}`;
  const memberDirectoryResponse = await page.request.get(
    `${baseUrl}/api/v1/organization/members?page=1&size=50`,
    { headers },
  );
  expect(memberDirectoryResponse.ok()).toBeTruthy();
  const follower = firstUniqueVisibleMember(await memberDirectoryResponse.json(), 900001);
  expect(follower).not.toBeNull();
  if (follower === null) {
    throw new Error("The server-visible member directory did not return another active member.");
  }

  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/tasks`, {
    data: { assigneeActorId: 900001, followerActorIds: [900001], title },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const createdTask = await createResponse.json();
  const taskId = identifierFrom(createdTask);
  const version = versionFrom(createdTask);
  expect(taskId).not.toBeNull();
  expect(version).not.toBeNull();
  if (taskId === null || version === null) {
    throw new Error("Work task did not return a stable identity and version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/tasks/${taskId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "管理关注人", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "管理关注人" });
  await expect(dialog.getByRole("button", { name: "移除成员 900001", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "移除成员 900001", exact: true }).click();

  const followerSearch = dialog.getByRole("searchbox", {
    name: "按成员姓名搜索关注人",
    exact: true,
  });
  const memberSearchResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/organization/members" &&
      response.request().method() === "GET" &&
      new URL(response.url()).searchParams.get("keyword") === follower.displayName,
  );
  await followerSearch.fill(follower.displayName);
  await followerSearch.press("Enter");
  await memberSearchResponse;
  await dialog
    .getByRole("listitem")
    .filter({ hasText: follower.displayName })
    .getByRole("button", { name: "添加关注人", exact: true })
    .click();

  const replaceRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}/followers` &&
      request.method() === "PUT",
  );
  await dialog.getByRole("button", { name: "保存关注人", exact: true }).click();
  expect((await replaceRequest).postDataJSON()).toEqual({
    followerActorIds: [follower.actorId],
    version,
  });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
});

test("task manager replaces a due task reminder plan from its dedicated baseline", async ({
  page,
}) => {
  const suffix = Date.now();
  const title = `E2E Work Reminder ${suffix}`;
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/tasks`, {
    data: { assigneeActorId: 900001, dueTime: "2026-07-30T09:00:00", title },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const createdTask = await createResponse.json();
  const taskId = identifierFrom(createdTask);
  const version = versionFrom(createdTask);
  expect(taskId).not.toBeNull();
  expect(version).not.toBeNull();
  if (taskId === null || version === null) {
    throw new Error("Work task did not return a stable identity and version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/tasks/${taskId}`, { waitUntil: "networkidle" });
  const baselineRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}/reminders` &&
      request.method() === "GET",
  );
  await page.getByRole("button", { name: "管理任务提醒", exact: true }).click();
  await baselineRequest;
  const dialog = page.getByRole("dialog", { name: "管理任务提醒" });
  await expect(dialog.getByText("暂无任务提醒", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "添加提醒", exact: true }).click();

  const replaceRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}/reminders` &&
      request.method() === "PUT",
  );
  await dialog.getByRole("button", { name: "保存提醒", exact: true }).click();
  expect((await replaceRequest).postDataJSON()).toEqual({
    steps: [{ offsetMinutes: 0, recipientRoles: ["ASSIGNEE"], timing: "AT_DUE" }],
    version,
  });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
});

test("visible writer replaces and clears a task business relation", async ({ page }) => {
  const suffix = Date.now();
  const title = `E2E Work Replace Relation ${suffix}`;
  const initialCustomerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Work Initial Customer ${suffix}` },
    headers,
  });
  expect(initialCustomerResponse.ok()).toBeTruthy();
  const initialCustomerId = identifierFrom(await initialCustomerResponse.json());
  expect(initialCustomerId).not.toBeNull();
  if (initialCustomerId === null) throw new Error("Initial customer did not return an ID.");
  const replacementCustomerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Work Replacement Customer ${suffix}` },
    headers,
  });
  expect(replacementCustomerResponse.ok()).toBeTruthy();
  const replacementCustomerId = identifierFrom(await replacementCustomerResponse.json());
  expect(replacementCustomerId).not.toBeNull();
  if (replacementCustomerId === null) {
    throw new Error("Replacement customer did not return an ID.");
  }
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/tasks`, {
    data: {
      assigneeActorId: 900001,
      businessObjectType: "CUSTOMER",
      businessRecordId: initialCustomerId,
      title,
    },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const createdTask = await createResponse.json();
  const taskId = identifierFrom(createdTask);
  const version = versionFrom(createdTask);
  expect(taskId).not.toBeNull();
  expect(version).not.toBeNull();
  if (taskId === null || version === null) {
    throw new Error("Work task did not return a stable identity and version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/tasks/${taskId}`, { waitUntil: "networkidle" });
  await expect(page.getByText(`客户 #${initialCustomerId}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "变更业务关联", exact: true }).click();
  const relationDialog = page.getByRole("dialog", { name: "关联业务记录", exact: true });
  await relationDialog.getByRole("combobox", { name: "关联业务类型", exact: true }).click();
  await page.getByText("客户", { exact: true }).last().click();
  await relationDialog
    .getByLabel("关联业务记录 ID", { exact: true })
    .fill(String(replacementCustomerId));
  const replaceResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/work/tasks/${taskId}/business-record` &&
      response.request().method() === "PUT" &&
      response.ok(),
  );
  await relationDialog.getByRole("button", { name: "保存关联", exact: true }).click();
  const updatedTask = await replaceResponse;
  expect(updatedTask.request().postDataJSON()).toEqual({
    businessObjectType: "CUSTOMER",
    businessRecordId: replacementCustomerId,
    version,
  });
  const updatedVersion = versionFrom(await updatedTask.json());
  expect(updatedVersion).not.toBeNull();
  if (updatedVersion === null) throw new Error("Updated task did not return a version.");
  await expect(page.getByText(`客户 #${replacementCustomerId}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "清除业务关联", exact: true }).click();
  const clearRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}/business-record` &&
      request.method() === "PUT",
  );
  await page
    .getByRole("tooltip")
    .getByRole("button", { name: /清\s*除/ })
    .click();
  expect((await clearRequest).postDataJSON()).toEqual({ version: updatedVersion });
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByText("未关联", { exact: true })).toBeVisible();
});

test("task manager cancels an open task with the current version", async ({ page }) => {
  const suffix = Date.now();
  const title = `E2E Work Cancel ${suffix}`;
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/tasks`, {
    data: { assigneeActorId: 900001, title },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const createdTask = await createResponse.json();
  const taskId = identifierFrom(createdTask);
  const version = versionFrom(createdTask);
  expect(taskId).not.toBeNull();
  expect(version).not.toBeNull();
  if (taskId === null || version === null) {
    throw new Error("Work task did not return a stable identity and version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/tasks/${taskId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "取消任务", exact: true }).click();
  const cancelRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}/cancel` &&
      request.method() === "POST",
  );
  await page.getByRole("button", { name: "确认取消", exact: true }).click();
  expect((await cancelRequest).postDataJSON()).toEqual({ version });
  await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "取消任务", exact: true })).toHaveCount(0);
});

test("task manager deletes a never-started task with the current version", async ({ page }) => {
  const suffix = Date.now();
  const title = `E2E Work Delete ${suffix}`;
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/tasks`, {
    data: { assigneeActorId: 900001, title },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const createdTask = await createResponse.json();
  const taskId = identifierFrom(createdTask);
  const version = versionFrom(createdTask);
  expect(taskId).not.toBeNull();
  expect(version).not.toBeNull();
  if (taskId === null || version === null) {
    throw new Error("Work task did not return a stable identity and version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/tasks/${taskId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "删除任务", exact: true }).click();
  const deleteRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}` &&
      request.method() === "DELETE",
  );
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  expect(new URL((await deleteRequest).url()).searchParams.toString()).toBe(`version=${version}`);
  await expect(page).toHaveURL(`${baseUrl}/work/tasks`);
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});

test("visible participant opens the authenticated Work task attachment browser", async ({
  page,
}) => {
  const suffix = Date.now();
  const title = `E2E Work Attachments ${suffix}`;
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/tasks`, {
    data: { assigneeActorId: 900001, title },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const taskId = identifierFrom(await createResponse.json());
  expect(taskId).not.toBeNull();
  if (taskId === null) throw new Error("Work task did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/tasks/${taskId}`, { waitUntil: "networkidle" });
  const attachmentQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname ===
        `/api/v1/attachment-targets/work-task/${taskId}/attachments` && request.method() === "GET",
  );
  await page.getByRole("button", { name: /任务附件/ }).click();
  const attachmentsDialog = page.getByRole("dialog", { name: "任务附件" });
  await expect(attachmentsDialog).toBeVisible();
  expect(new URL((await attachmentQuery).url()).searchParams.toString()).toBe("page=1&size=20");
});

test("current participant browses Work tasks through the narrow list and detail projections", async ({
  page,
}) => {
  const suffix = Date.now();
  const title = `E2E Work Task ${suffix}`;
  const description = `Private work task description ${suffix}`;
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/tasks`, {
    data: {
      assigneeActorId: 900001,
      description,
      dueTime: "2026-07-27T09:00:00",
      priority: "HIGH",
      title,
    },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const taskId = identifierFrom(await createResponse.json());
  expect(taskId).not.toBeNull();
  if (taskId === null) throw new Error("Work task did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  const taskQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/work/tasks/query" && request.method() === "POST",
  );
  await page.goto(`${baseUrl}/work/tasks`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Work 任务", exact: true })).toBeVisible();
  await expect(page.getByLabel("桌面列表").getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toHaveCount(0);
  expect((await taskQuery).postDataJSON()).toEqual({ page: 1, size: 15 });

  const detailRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}` &&
      request.method() === "GET",
  );
  await page.getByLabel("桌面列表").getByRole("link", { name: title }).click();

  await expect(page).toHaveURL(`${baseUrl}/work/tasks/${taskId}`);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toHaveCount(0);
  await detailRequest;
});

test("current assignee progresses a Work task with the returned versions", async ({ page }) => {
  const suffix = Date.now();
  const title = `E2E Work Progress ${suffix}`;
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/tasks`, {
    data: { assigneeActorId: 900001, title },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const createdTask = await createResponse.json();
  const taskId = identifierFrom(createdTask);
  const initialVersion = versionFrom(createdTask);
  expect(taskId).not.toBeNull();
  expect(initialVersion).not.toBeNull();
  if (taskId === null || initialVersion === null) {
    throw new Error("Work task did not return a stable identity and version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/work/tasks/${taskId}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();

  const startRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}/start` &&
      request.method() === "POST",
  );
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  expect((await startRequest).postDataJSON()).toEqual({ version: initialVersion });
  await expect(page.getByText("IN_PROGRESS", { exact: true })).toBeVisible();

  const returnRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}/return-to-todo` &&
      request.method() === "POST",
  );
  await page.getByRole("button", { name: "退回待办", exact: true }).click();
  expect((await returnRequest).postDataJSON()).toEqual({ version: initialVersion + 1 });
  await expect(page.getByText("TODO", { exact: true })).toBeVisible();
});

test("visible participant reads and publishes task comments without rendering the author", async ({
  page,
}) => {
  const suffix = Date.now();
  const title = `E2E Work Comment ${suffix}`;
  const content = `E2E Comment ${suffix}`;
  const createResponse = await page.request.post(`${baseUrl}/api/v1/work/tasks`, {
    data: { assigneeActorId: 900001, title },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();
  const taskId = identifierFrom(await createResponse.json());
  expect(taskId).not.toBeNull();
  if (taskId === null) throw new Error("Work task did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  const commentQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}/comments` &&
      request.method() === "GET",
  );
  await page.goto(`${baseUrl}/work/tasks/${taskId}`, { waitUntil: "networkidle" });
  expect(new URL((await commentQuery).url()).searchParams.toString()).toBe("page=1&size=20");

  await page.getByLabel("评论内容").fill(content);
  const commentCreate = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/work/tasks/${taskId}/comments` &&
      request.method() === "POST",
  );
  await page.getByRole("button", { name: "发表评论", exact: true }).click();
  expect((await commentCreate).postDataJSON()).toEqual({ content });
  await expect(page.getByText(content, { exact: true })).toBeVisible();
});
