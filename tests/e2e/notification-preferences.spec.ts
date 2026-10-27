import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("authorized member replaces only the two typed notification preferences", async ({ page }) => {
  let preference = { emailEnabled: false, oaAnnouncementEmailEnabled: true };
  await page.route("**/api/v1/notifications/preferences", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", json: preference });
      return;
    }

    expect(request.method()).toBe("PUT");
    expect(request.postDataJSON()).toEqual({
      emailEnabled: true,
      oaAnnouncementEmailEnabled: false,
    });
    preference = request.postDataJSON() as typeof preference;
    await route.fulfill({ contentType: "application/json", json: preference });
  });

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "工具与设置", exact: true }).click();
  await page.getByRole("menuitem", { name: "设置通知", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "通知偏好" });
  await expect(dialog.getByRole("switch", { name: "接收邮件通知" })).not.toBeChecked();
  await expect(dialog.getByRole("switch", { name: "接收 OA 公告邮件" })).toBeChecked();
  await dialog.getByRole("switch", { name: "接收邮件通知" }).click();
  await dialog.getByRole("switch", { name: "接收 OA 公告邮件" }).click();
  await dialog.getByRole("button", { name: "保存通知偏好", exact: true }).click();

  await expect(dialog).toHaveCount(0);
});
