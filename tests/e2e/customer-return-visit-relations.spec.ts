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

test("return-visit relations select visible current-customer contacts and contracts independently", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerName = `E2E Return Visit Relation Customer ${suffix}`;
  const firstContactName = `E2E Return Visit Contact A ${suffix}`;
  const secondContactName = `E2E Return Visit Contact B ${suffix}`;
  const firstContractName = `E2E Return Visit Contract A ${suffix}`;
  const secondContractName = `E2E Return Visit Contract B ${suffix}`;
  const remark = `E2E 回访关联基线 ${suffix}`;

  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  async function createContact(name: string): Promise<number> {
    const response = await page.request.post(`${baseUrl}/api/v1/contacts`, {
      data: { customerId, name },
      headers,
    });
    expect(response.ok()).toBeTruthy();
    const id = identifierFrom(await response.json());
    expect(id).not.toBeNull();
    if (id === null) throw new Error("Contact did not return an ID.");
    return id;
  }

  async function createContract(name: string, number: string): Promise<number> {
    const response = await page.request.post(`${baseUrl}/api/v1/contracts`, {
      data: { customerId, name, number, products: [] },
      headers,
    });
    expect(response.ok()).toBeTruthy();
    const id = identifierFrom(await response.json());
    expect(id).not.toBeNull();
    if (id === null) throw new Error("Contract did not return an ID.");
    return id;
  }

  const firstContactId = await createContact(firstContactName);
  const secondContactId = await createContact(secondContactName);
  const firstContractId = await createContract(firstContractName, `E2E-RV-A-${suffix}`);
  const secondContractId = await createContract(secondContractName, `E2E-RV-B-${suffix}`);

  const returnVisitResponse = await page.request.post(`${baseUrl}/api/v1/return-visits`, {
    data: {
      contactId: firstContactId,
      contractId: firstContractId,
      customerId,
      remark,
      visitTime: "2026-07-26T09:00:00",
    },
    headers,
  });
  expect(returnVisitResponse.ok()).toBeTruthy();
  const returnVisit = await returnVisitResponse.json();
  const returnVisitId = identifierFrom(returnVisit);
  const initialVersion = versionFrom(returnVisit);
  expect(returnVisitId).not.toBeNull();
  expect(initialVersion).not.toBeNull();
  if (returnVisitId === null || initialVersion === null) {
    throw new Error("Return visit did not return an ID and version.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/return-visits/${returnVisitId}`, {
    waitUntil: "networkidle",
  });

  await page.getByRole("button", { name: "更换联系人" }).click();
  const contactDialog = page.getByRole("dialog", { name: "选择联系人" });
  const contactQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contacts/query" &&
      request.method() === "POST" &&
      request.postData()?.includes(secondContactName) === true,
  );
  await contactDialog.getByPlaceholder("按联系人姓名搜索").fill(secondContactName);
  await contactDialog.getByPlaceholder("按联系人姓名搜索").press("Enter");
  expect((await contactQuery).postDataJSON()).toEqual({
    customerId,
    keyword: secondContactName,
    page: 1,
    size: 50,
  });
  const contactItem = contactDialog
    .getByRole("heading", { name: secondContactName, exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(contactItem).toBeVisible();

  const contactUpdateRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/return-visits/${returnVisitId}` &&
      request.method() === "PUT",
  );
  await contactItem.getByRole("button", { name: "选择" }).click();
  const contactUpdate = await contactUpdateRequest;
  expect(contactUpdate.postDataJSON()).toEqual({
    contactId: secondContactId,
    remark,
    version: initialVersion,
    visitTime: "2026-07-26T09:00:00",
  });
  const contactUpdateResponse = await contactUpdate.response();
  const updatedAfterContact =
    contactUpdateResponse === null ? null : await contactUpdateResponse.json();
  const versionAfterContact = versionFrom(updatedAfterContact);
  expect(versionAfterContact).not.toBeNull();
  if (versionAfterContact === null)
    throw new Error("Relation update did not return a new version.");
  await expect(contactDialog).toBeHidden();
  await expect(page.getByText(`联系人 ${secondContactId}`, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "更换合同" }).click();
  const contractDialog = page.getByRole("dialog", { name: "选择合同" });
  const contractQuery = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contracts/query" &&
      request.method() === "POST" &&
      request.postData()?.includes(secondContractName) === true,
  );
  await contractDialog.getByPlaceholder("按合同名称搜索").fill(secondContractName);
  await contractDialog.getByPlaceholder("按合同名称搜索").press("Enter");
  expect((await contractQuery).postDataJSON()).toEqual({
    customerId,
    keyword: secondContractName,
    page: 1,
    size: 50,
  });
  const contractItem = contractDialog
    .getByRole("heading", { name: secondContractName, exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(contractItem).toBeVisible();

  const contractUpdateRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/v1/return-visits/${returnVisitId}` &&
      request.method() === "PUT",
  );
  await contractItem.getByRole("button", { name: "选择" }).click();
  expect((await contractUpdateRequest).postDataJSON()).toEqual({
    contractId: secondContractId,
    remark,
    version: versionAfterContact,
    visitTime: "2026-07-26T09:00:00",
  });

  await expect(contractDialog).toBeHidden();
  await expect(page.getByText(`联系人 ${secondContactId}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`合同 ${secondContractId}`, { exact: true })).toBeVisible();
});
