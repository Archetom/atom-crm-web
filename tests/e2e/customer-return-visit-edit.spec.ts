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

test("return-visit edit preserves omitted contact and contract relations", async ({ page }) => {
  const suffix = Date.now();
  const customerName = `E2E Return Visit Edit Customer ${suffix}`;
  const contactName = `E2E Return Visit Edit Contact ${suffix}`;
  const contractName = `E2E Return Visit Edit Contract ${suffix}`;
  const contractNumber = `E2E-RV-${suffix}`;
  const originalRemark = `E2E 原始回访备注 ${suffix}`;
  const updatedRemark = `E2E 更新回访备注 ${suffix}`;

  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  const contactResponse = await page.request.post(`${baseUrl}/api/v1/contacts`, {
    data: { customerId, name: contactName },
    headers,
  });
  expect(contactResponse.ok()).toBeTruthy();
  const contactId = identifierFrom(await contactResponse.json());
  expect(contactId).not.toBeNull();
  if (contactId === null) throw new Error("Contact did not return an ID.");

  const contractResponse = await page.request.post(`${baseUrl}/api/v1/contracts`, {
    data: { customerId, name: contractName, number: contractNumber, products: [] },
    headers,
  });
  expect(contractResponse.ok()).toBeTruthy();
  const contractId = identifierFrom(await contractResponse.json());
  expect(contractId).not.toBeNull();
  if (contractId === null) throw new Error("Contract did not return an ID.");

  const returnVisitResponse = await page.request.post(`${baseUrl}/api/v1/return-visits`, {
    data: {
      contactId,
      contractId,
      customerId,
      remark: originalRemark,
      visitTime: "2026-07-26T09:00:00",
    },
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
  await page.getByRole("button", { name: "编辑回访" }).click();
  await expect(page.getByRole("heading", { name: "编辑回访", exact: true })).toBeVisible();
  await page.getByLabel("客户反馈").fill(updatedRemark);

  const updateRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/return-visits/${returnVisitId}` &&
      request.method() === "PUT",
  );
  await page.getByRole("button", { name: "保存修改" }).click();

  const payload = (await updateRequest).postDataJSON() as Record<string, unknown>;
  expect(payload).toMatchObject({
    remark: updatedRemark,
    version,
    visitTime: "2026-07-26T09:00:00",
  });
  expect(payload).not.toHaveProperty("contactId");
  expect(payload).not.toHaveProperty("contractId");

  await expect(page).toHaveURL(
    `${baseUrl}/crm/customers/${customerId}/return-visits/${returnVisitId}`,
  );
  await expect(page.getByText(`联系人 ${contactId}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`合同 ${contractId}`, { exact: true })).toBeVisible();
  await expect(page.getByText(updatedRemark, { exact: true })).toBeVisible();
});
