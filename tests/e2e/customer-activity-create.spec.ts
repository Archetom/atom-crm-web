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

function methodValuesFrom(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return [];
    const { type, value: methodValue } = item as { type?: unknown; value?: unknown };
    return type === "METHOD" && typeof methodValue === "string" ? [methodValue] : [];
  });
}

test("customer detail creates a follow-up from a server-governed method", async ({ page }) => {
  const suffix = Date.now();
  const customerName = `E2E Activity Create Customer ${suffix}`;
  const activityContent = `E2E 跟进内容 ${suffix}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: { name: customerName },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customerId = customerIdFrom(await customerResponse.json());
  expect(customerId).not.toBeNull();
  if (customerId === null) throw new Error("Customer did not return an ID.");

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/customers/${customerId}`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: customerName, exact: true })).toBeVisible();
  const methodOptionsResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/activities/options" &&
      response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "写跟进" }).click();
  const methodValues = methodValuesFrom(await (await methodOptionsResponse).json());
  expect(methodValues).not.toHaveLength(0);
  const dialog = page.getByRole("dialog", { name: "写跟进" });
  const methodSelect = dialog.getByLabel("跟进方式");
  await expect(methodSelect).toBeEnabled();
  await methodSelect.click();
  await methodSelect.press("ArrowDown");
  await methodSelect.press("Enter");
  await dialog.getByLabel("跟进目的").fill("需求确认");
  await dialog.getByLabel("跟进内容").fill(activityContent);

  const createRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/v1/activities" && request.method() === "POST",
  );
  await dialog.getByRole("button", { name: "提交跟进" }).click();

  const postData = (await createRequest).postDataJSON() as {
    category?: unknown;
    content?: unknown;
    occurredTime?: unknown;
    purpose?: unknown;
    subjectId?: unknown;
    subjectType?: unknown;
  };
  expect(postData).toMatchObject({
    content: activityContent,
    purpose: "需求确认",
    subjectId: customerId,
    subjectType: "CUSTOMER",
  });
  expect(methodValues).toContain(postData.category);
  expect(postData.occurredTime).toEqual(
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
  );
  await expect(dialog).toBeHidden();
  await expect(page.getByText(activityContent, { exact: true })).toBeVisible();
});
