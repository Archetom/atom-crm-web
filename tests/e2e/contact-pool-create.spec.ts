import { expect, test } from "./support/contact-pool-test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("a management-authorized member creates a contact pool with a server-visible administrator", async ({
  page,
}) => {
  const name = `E2E Created Pool ${Date.now()}`;

  await page.goto(`${baseUrl}/crm/contact-pools/manage`, { waitUntil: "networkidle" });

  await page.getByRole("button", { exact: true, name: "新建联系人公海" }).click();
  const createDialog = page.getByRole("dialog", { name: "新建联系人公海" });
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel("联系人公海名称").fill(name);
  await createDialog
    .getByRole("listitem")
    .filter({ hasText: "E2E Tenant Owner" })
    .getByRole("button", { exact: true, name: "添加管理员" })
    .click();
  await createDialog.getByRole("button", { exact: true, name: "创建公海" }).click();

  await expect(createDialog).toHaveCount(0);
  await expect(page.getByLabel("桌面列表").getByText(name, { exact: true })).toBeVisible();
});
