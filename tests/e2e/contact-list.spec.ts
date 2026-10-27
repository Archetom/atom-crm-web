import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("contact list keeps a flat, one-based query and shows its follow-up summary columns", async ({
  page,
}) => {
  let contactRequest: { body: unknown; method: string; url: string } | null = null;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/contacts/query") {
      contactRequest = {
        body: request.postDataJSON(),
        method: request.method(),
        url: request.url(),
      };
    }
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });

  await page.goto(`${baseUrl}/crm/contacts?page=2&size=50&keyword=%E5%BC%A0`, {
    waitUntil: "networkidle",
  });

  await expect(page.getByRole("heading", { name: "联系人管理", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("搜索联系人")).toHaveValue("张");
  await expect(page.getByRole("columnheader", { name: "最后跟进时间", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "最后跟进记录", exact: true })).toBeVisible();
  await expect.poll(() => contactRequest?.url).toBe(`${baseUrl}/api/v1/contacts/query`);
  expect(contactRequest?.method).toBe("POST");
  expect(contactRequest?.body).toEqual({
    keyword: "张",
    page: 2,
    size: 50,
  });

  await page.getByRole("button", { name: "导出 CSV" }).click();
  const exportDialog = page.getByRole("dialog", { name: "导出联系人 CSV" });
  await expect(exportDialog).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "导出 CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("contacts.csv");
});
