import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

const referenceManagementPages = [
  { path: "/crm/products", title: "产品管理" },
  { path: "/crm/contracts", title: "合同管理" },
  { path: "/crm/receivables", title: "回款管理" },
  { path: "/crm/invoices", title: "发票管理" },
  { path: "/crm/return-visits", title: "回访管理" },
] as const;

test("core CRM record lists use the reference management headings", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });

  for (const referencePage of referenceManagementPages) {
    await page.goto(`${baseUrl}${referencePage.path}`, { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { level: 1, name: referencePage.title, exact: true }),
    ).toBeVisible();
  }
});
