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

test("customer contract creation sends only a selected server-visible contact", async ({
  page,
}) => {
  const suffix = Date.now();
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: `E2E Contract Relation Customer ${suffix}` },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = identifierFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) {
    throw new Error("Customer did not return an ID.");
  }
  const contactName = `E2E Contract Contact ${suffix}`;
  const contactResponse = await page.request.post(`${baseUrl}/api/v1/contacts`, {
    data: { customerId, name: contactName },
    headers,
  });
  expect(contactResponse.ok()).toBeTruthy();
  const contactId = identifierFrom(await contactResponse.json());
  expect(contactId).not.toBeNull();
  if (contactId === null) {
    throw new Error("Contact did not return an ID.");
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}/contracts/new`, {
    waitUntil: "networkidle",
  });
  await page.getByLabel("合同名称").fill(`E2E Contact Contract ${suffix}`);
  await page.getByLabel("合同编号").fill(`E2E-CONTACT-${suffix}`);
  await page.getByRole("button", { name: "选择联系人" }).click();
  const contactDialog = page.getByRole("dialog", { name: "选择联系人" });
  await contactDialog.getByPlaceholder("按联系人姓名搜索").fill(contactName);
  await contactDialog.getByPlaceholder("按联系人姓名搜索").press("Enter");
  await contactDialog.getByRole("button", { name: /选\s*择/ }).click();
  await expect(contactDialog).toBeHidden();

  const createRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/contracts" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "创建合同" }).click();

  expect((await createRequest).postDataJSON()).toMatchObject({
    contactId,
    customerId,
  });
  await expect(page).toHaveURL(new RegExp(`/crm/customers/${customerId}/contracts/\\d+$`));
});
