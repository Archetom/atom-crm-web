import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function customerIdFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { id } = value as { id?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

test("customer detail reads a narrow server-visible activity timeline", async ({ page }) => {
  const suffix = Date.now();
  const customerName = `E2E Activity Customer ${suffix}`;
  const activityContent = `E2E 已确认需求 ${suffix}`;
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
      content: activityContent,
      occurredTime: "2026-07-25T09:00:00",
      purpose: "需求确认",
      subjectId: customerId,
      subjectType: "CUSTOMER",
    },
    headers,
  });
  expect(activityResponse.ok()).toBeTruthy();

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  const timelineRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/activities/query" && request.method() === "POST",
  );
  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: customerName, exact: true })).toBeVisible();
  await expect(page.getByText("跟进记录", { exact: true })).toBeVisible();
  await expect(page.getByText(activityContent, { exact: true })).toBeVisible();
  await expect(page.getByText("CALL · 需求确认", { exact: true })).toBeVisible();
  expect((await timelineRequest).postDataJSON()).toEqual({
    page: 1,
    size: 20,
    subjectId: customerId,
    subjectType: "CUSTOMER",
  });
});
