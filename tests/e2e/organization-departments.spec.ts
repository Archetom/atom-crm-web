import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

const departments = [
  { active: true, id: 10, name: "E2E 销售部", status: "ACTIVE" },
  { active: true, id: 11, name: "E2E 华东组", parentDepartmentId: 10, status: "ACTIVE" },
];

test("department workbench restores only a server-visible selection and resets its member page", async ({
  page,
}) => {
  const memberRequests: URL[] = [];

  await page.route("**/api/v1/authorization/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        actorId: 900001,
        authorities: ["organization:read", "roles:read", "users:read"],
        dataScopes: {},
        roles: [],
      },
    });
  });
  await page.route("**/api/v1/navigation", async (route) => {
    await route.fulfill({ contentType: "application/json", json: [] });
  });
  await page.route(/\/api\/v1\/organization\/departments(?:\?.*)?$/, async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ contentType: "application/json", json: departments });
  });
  await page.route(
    /\/api\/v1\/organization\/departments\/(10|11)\/members(?:\?.*)?$/,
    async (route) => {
      expect(route.request().method()).toBe("GET");
      const requestUrl = new URL(route.request().url());
      memberRequests.push(requestUrl);
      const departmentId = Number(requestUrl.pathname.split("/").at(-2));
      await route.fulfill({
        contentType: "application/json",
        json: {
          objectList: [
            {
              active: true,
              actorId: departmentId === 10 ? 71 : 72,
              departmentName: departmentId === 10 ? "E2E 销售部" : "E2E 华东组",
              displayName: departmentId === 10 ? "E2E Alice" : "E2E Bob",
              email: null,
              loginName: departmentId === 10 ? "e2e.alice" : "e2e.bob",
              maskedPhoneNumber: null,
              roleNames: ["E2E 角色"],
            },
          ],
          pageNum: Number(requestUrl.searchParams.get("page")),
          pageSize: Number(requestUrl.searchParams.get("size")),
          totalNum: 1,
        },
      });
    },
  );
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });

  await page.goto(
    `${baseUrl}/organization/departments?departmentId=10&includeDescendants=true&memberKeyword=alice&memberPage=2`,
    { waitUntil: "networkidle" },
  );

  await expect(page.getByRole("heading", { name: "员工与部门管理" })).toBeVisible();
  await expect(page.getByLabel("按部门搜索成员")).toHaveValue("alice");
  await expect(page.getByRole("checkbox", { name: "包含子部门" })).toBeChecked();
  await expect(page.getByLabel("桌面列表").getByText("E2E Alice", { exact: true })).toBeVisible();
  await expect(page.getByLabel("桌面列表").getByText("e2e.alice", { exact: true })).toBeVisible();
  await expect(page.getByLabel("桌面列表").getByText("E2E 角色", { exact: true })).toBeVisible();
  await expect.poll(() => memberRequests.length).toBe(1);
  expect(memberRequests[0]?.pathname).toBe("/api/v1/organization/departments/10/members");
  expect(Object.fromEntries(memberRequests[0]!.searchParams)).toEqual({
    includeDescendants: "true",
    keyword: "alice",
    page: "2",
    size: "15",
  });

  await page.getByText("E2E 华东组", { exact: true }).click();

  await expect(page.getByLabel("桌面列表").getByText("E2E Bob", { exact: true })).toBeVisible();
  await expect.poll(() => memberRequests.length).toBe(2);
  expect(memberRequests[1]?.pathname).toBe("/api/v1/organization/departments/11/members");
  expect(Object.fromEntries(memberRequests[1]!.searchParams)).toEqual({
    includeDescendants: "true",
    keyword: "alice",
    page: "1",
    size: "15",
  });
  await expect(page).toHaveURL(/departmentId=11/);
  await expect(page).toHaveURL(/memberPage=1/);
});

test("department workbench does not query a member endpoint for an arbitrary URL ID", async ({
  page,
}) => {
  let memberRequestCount = 0;

  await page.route("**/api/v1/authorization/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        actorId: 900001,
        authorities: ["organization:read"],
        dataScopes: {},
        roles: [],
      },
    });
  });
  await page.route("**/api/v1/navigation", async (route) => {
    await route.fulfill({ contentType: "application/json", json: [] });
  });
  await page.route(/\/api\/v1\/organization\/departments(?:\?.*)?$/, async (route) => {
    await route.fulfill({ contentType: "application/json", json: departments });
  });
  await page.route("**/api/v1/organization/departments/*/members*", async (route) => {
    memberRequestCount += 1;
    await route.abort();
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });

  await page.goto(`${baseUrl}/organization/departments?departmentId=999`, {
    waitUntil: "networkidle",
  });

  await expect(page.getByText("请选择当前可见的部门后查看成员。")).toBeVisible();
  expect(memberRequestCount).toBe(0);
});
