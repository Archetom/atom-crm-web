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

function returnVisitIdFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { id } = value as { id?: unknown };
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

test("customer detail enters a server-scoped return-visit list without a navigation entry", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Return Visit Customer ${suffix}`;
  const remark = `E2E 确认回访安排 ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = customerIdFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const returnVisitResponse = await page.request.post(`${baseUrl}/api/v1/return-visits`, {
    data: { customerId, remark, visitTime: "2026-07-25T09:00:00" },
    headers,
  });
  expect(returnVisitResponse.ok()).toBeTruthy();
  const returnVisitId = returnVisitIdFrom(await returnVisitResponse.json());
  expect(returnVisitId).not.toBeNull();
  if (returnVisitId === null) throw new Error("Return visit did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  const returnVisitRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/return-visits/query" &&
      request.method() === "POST",
  );
  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "查看回访" }).click();

  await expect(page).toHaveURL(`${baseUrl}/crm/customers/${customerId}/return-visits`);
  await expect(page.getByRole("heading", { name: "客户回访", exact: true })).toBeVisible();
  await expect(page.getByLabel("桌面列表").getByText(remark, { exact: true })).toBeVisible();
  expect((await returnVisitRequest).postDataJSON()).toEqual({
    customerId,
    page: 1,
    size: 15,
  });

  const detailRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/return-visits/${returnVisitId}` &&
      request.method() === "GET",
  );
  await page.getByLabel("桌面列表").getByRole("link").click();
  await expect(page).toHaveURL(
    `${baseUrl}/crm/customers/${customerId}/return-visits/${returnVisitId}`,
  );
  await expect(page.getByRole("heading", { name: "回访详情", exact: true })).toBeVisible();
  await expect(page.getByText(remark, { exact: true })).toBeVisible();
  await detailRequest;
});
