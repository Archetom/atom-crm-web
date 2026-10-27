import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const location = { latitude: 31.2304, longitude: 121.4737 };

test("a member explicitly authorizes location before querying nearby visible customers", async ({
  page,
}) => {
  const identityId = Date.now();
  const headers = {
    "X-Dev-Tenant-Id": String(identityId),
    "X-Dev-User-Id": String(identityId),
  };
  const bootstrapResponse = await page.request.post(`${baseUrl}/api/v1/organization/bootstrap`, {
    data: { displayName: "E2E Nearby Customer Owner" },
    headers,
  });
  expect(bootstrapResponse.ok()).toBeTruthy();

  const customerName = `E2E Nearby Customer ${identityId}`;
  const customerResponse = await page.request.post(`${baseUrl}/api/v1/customers`, {
    data: {
      name: customerName,
      addresses: [
        {
          addressLine: "E2E nearby customer address",
          latitude: location.latitude,
          longitude: location.longitude,
          primary: true,
        },
      ],
    },
    headers,
  });
  expect(customerResponse.ok()).toBeTruthy();

  await page.context().grantPermissions(["geolocation"], { origin: baseUrl });
  await page.context().setGeolocation({ ...location, accuracy: 10 });
  let nearbyRequestUrl: string | null = null;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/customers/nearby") {
      nearbyRequestUrl = request.url();
    }
  });
  await page.addInitScript((actorId: number) => {
    sessionStorage.setItem("atom-crm.dev.actor-id", String(actorId));
    sessionStorage.setItem("atom-crm.dev.tenant-id", String(actorId));
  }, identityId);
  await page.goto(`${baseUrl}/crm/customers/nearby?radius=5000`, { waitUntil: "networkidle" });

  await expect(page.getByText("请先授权浏览器定位，再查询附近客户。")).toBeVisible();
  await page.getByRole("button", { name: "获取当前位置" }).click();
  await expect(page.getByLabel("桌面列表").getByText(customerName, { exact: true })).toBeVisible();
  await expect
    .poll(() => nearbyRequestUrl)
    .toBe(
      "http://localhost:5173/api/v1/customers/nearby?longitude=121.4737&latitude=31.2304&radiusMeters=5000&page=1&size=15",
    );
});
