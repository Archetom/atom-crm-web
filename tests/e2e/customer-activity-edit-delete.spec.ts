import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

interface VersionedActivity {
  id: number;
  version: number;
}

function customerIdFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { id } = value as { id?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function activityFrom(value: unknown, content: string): VersionedActivity | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { objectList } = value as { objectList?: unknown };
  if (!Array.isArray(objectList)) return null;

  for (const item of objectList) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as { content?: unknown; id?: unknown; kind?: unknown; version?: unknown };
    if (
      record.content === content &&
      record.kind === "FOLLOW_UP" &&
      typeof record.id === "number" &&
      Number.isSafeInteger(record.id) &&
      record.id > 0 &&
      typeof record.version === "number" &&
      Number.isSafeInteger(record.version) &&
      record.version >= 0
    ) {
      return { id: record.id, version: record.version };
    }
  }
  return null;
}

test("customer detail updates then explicitly deletes a caller-owned follow-up", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Activity Edit Customer ${suffix}`;
  const initialContent = `E2E 初始跟进内容 ${suffix}`;
  const updatedContent = `E2E 已更新跟进内容 ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = customerIdFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const activityResponse = await page.request.post(`${baseUrl}/api/v1/activities`, {
    data: {
      category: "CALL",
      content: initialContent,
      occurredTime: "2026-07-25T09:00:00",
      purpose: "需求确认",
      subjectId: customerId,
      subjectType: "CUSTOMER",
    },
    headers,
  });
  expect(activityResponse.ok()).toBeTruthy();
  const timelineResponse = await page.request.post(`${baseUrl}/api/v1/activities/query`, {
    data: { page: 1, size: 20, subjectId: customerId, subjectType: "CUSTOMER" },
    headers,
  });
  expect(timelineResponse.ok()).toBeTruthy();
  const activity = activityFrom(await timelineResponse.json(), initialContent);
  expect(activity).not.toBeNull();
  if (activity === null) throw new Error("Activity did not return a versioned follow-up baseline.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });
  await expect(page.getByText(initialContent, { exact: true })).toBeVisible();

  const editDetailRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/activities/${activity.id}` &&
      request.method() === "GET",
  );
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "编辑跟进" });
  await expect(editDialog).toBeVisible();
  await editDetailRequest;
  await editDialog.getByLabel("编辑跟进目的").fill("已更新目的");
  await editDialog.getByLabel("编辑跟进内容").fill(updatedContent);

  const updateRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/activities/${activity.id}` &&
      request.method() === "PUT",
  );
  await editDialog.getByRole("button", { name: "保存更改" }).click();
  expect((await updateRequest).postDataJSON()).toEqual({
    category: "CALL",
    content: updatedContent,
    nextContactTime: null,
    occurredTime: "2026-07-25T09:00:00",
    purpose: "已更新目的",
    relations: [],
    version: activity.version,
  });
  await expect(editDialog).toBeHidden();
  await expect(page.getByText(updatedContent, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "删除", exact: true }).click();
  const deleteDialog = page.getByRole("dialog", { name: "删除跟进" });
  await expect(deleteDialog).toBeVisible();
  const deleteRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/activities/${activity.id}` &&
      request.method() === "DELETE",
  );
  await deleteDialog.getByRole("button", { name: "删除跟进", exact: true }).click();
  expect(new URL((await deleteRequest).url()).searchParams.get("version")).toBe(
    String(activity.version + 1),
  );
  await expect(deleteDialog).toBeHidden();
  await expect(page.getByText(updatedContent, { exact: true })).toBeHidden();
});
