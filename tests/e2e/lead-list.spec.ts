import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

test("lead list keeps a flat, one-based query and shows its follow-up summary columns", async ({
  page,
}) => {
  const leadName = `E2E Lead ${Date.now()}`;
  const leadResponse = await page.request.post(`${baseUrl}/api/v1/leads`, {
    data: { name: leadName },
    headers,
  });
  expect(leadResponse.ok()).toBeTruthy();

  let leadRequest: { body: unknown; method: string; url: string } | null = null;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/leads/query") {
      leadRequest = {
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
  await page.goto(`${baseUrl}/crm/leads?page=1&size=50&keyword=${encodeURIComponent(leadName)}`, {
    waitUntil: "networkidle",
  });

  await expect(page.getByRole("heading", { name: "线索管理", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("搜索线索")).toHaveValue(leadName);
  await expect(page.getByRole("columnheader", { name: "最后跟进时间", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "最后跟进记录", exact: true })).toBeVisible();
  await expect(page.getByLabel("桌面列表").getByText(leadName, { exact: true })).toBeVisible();
  await expect.poll(() => leadRequest?.url).toBe(`${baseUrl}/api/v1/leads/query`);
  expect(leadRequest?.method).toBe("POST");
  expect(leadRequest?.body).toEqual({
    converted: false,
    keyword: leadName,
    page: 1,
    size: 50,
  });
});
