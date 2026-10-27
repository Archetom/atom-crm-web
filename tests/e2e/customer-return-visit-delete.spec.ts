import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function identifierFrom(value: unknown): number | null {
  const id = recordOf(value)?.id;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function versionFrom(value: unknown): number | null {
  const version = recordOf(value)?.version;
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0
    ? version
    : null;
}

test("a return visit is deleted only after confirmation with its current version", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Return Visit Delete Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const returnVisitResponse = await page.request.post(`${baseUrl}/api/v1/return-visits`, {
    data: { customerId, visitTime: "2026-07-26T10:00:00" },
    headers,
  });
  expect(returnVisitResponse.ok()).toBeTruthy();
  const returnVisit = await returnVisitResponse.json();
  const returnVisitId = identifierFrom(returnVisit);
  const version = versionFrom(returnVisit);
  expect(returnVisitId).not.toBeNull();
  expect(version).not.toBeNull();
  if (returnVisitId === null || version === null) {
    throw new Error("Return visit did not return an ID and version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/return-visits/${returnVisitId}`, {
    waitUntil: "networkidle",
  });

  await page.getByRole("button", { name: "删除回访" }).click();
  const deleteRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/return-visits/${returnVisitId}` &&
      request.method() === "DELETE",
  );
  await page.getByRole("button", { name: "确认删除" }).click();

  expect(new URL((await deleteRequest).url()).searchParams.get("version")).toBe(String(version));
  await expect(page).toHaveURL(new RegExp(`/crm/customers/${customerId}/return-visits$`));
});
