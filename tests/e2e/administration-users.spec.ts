import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

const initialUser = {
  active: true,
  createdTime: "2026-07-30T00:00:00Z",
  email: "alice@example.test",
  id: 12,
  maskedPhoneNumber: null,
  realName: "Alice",
  status: "ACTIVE",
  statusName: "启用",
  updatedTime: "2026-07-30T00:00:00Z",
  username: "alice",
};

test("user administration uses the typed page and guards each lifecycle action", async ({
  page,
}) => {
  const createdUsername = `e2e_user_${Date.now()}`;
  const createdEmail = `${createdUsername}@example.test`;
  let users = [initialUser];
  const receivedPasswords: string[] = [];

  await page.route("**/api/v1/authorization/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        actorId: 900001,
        authorities: ["users:read", "users:write", "users:delete"],
        dataScopes: {},
        roles: [],
      },
    });
  });
  await page.route("**/api/v1/navigation", async (route) => {
    await route.fulfill({ contentType: "application/json", json: [] });
  });
  await page.route("**/api/v1/users*", async (route) => {
    if (route.request().method() === "GET") {
      expect(new URL(route.request().url()).searchParams.get("status")).not.toBe("DELETED");
      await route.fulfill({
        contentType: "application/json",
        json: { objectList: users, pageNum: 1, pageSize: 20, totalNum: users.length },
      });
      return;
    }

    expect(route.request().method()).toBe("POST");
    const request = await route.request().postDataJSON();
    expect(request).toEqual({
      email: createdEmail,
      password: "a-safe-e2e-password",
      username: createdUsername,
    });
    receivedPasswords.push(request.password);
    users = [
      ...users,
      {
        ...initialUser,
        email: createdEmail,
        id: 13,
        realName: null,
        updatedTime: "2026-07-30T00:01:00Z",
        username: createdUsername,
      },
    ];
    await route.fulfill({ contentType: "application/json", json: users[1] });
  });
  await page.route("**/api/v1/users/12/status?status=LOCKED", async (route) => {
    expect(route.request().method()).toBe("PUT");
    users = users.map((user) =>
      user.id === 12 ? { ...user, active: false, status: "LOCKED", statusName: "锁定" } : user,
    );
    await route.fulfill({ status: 204 });
  });
  await page.route("**/api/v1/users/12", async (route) => {
    expect(route.request().method()).toBe("DELETE");
    users = users.filter((user) => user.id !== 12);
    await route.fulfill({ status: 204 });
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });

  await page.goto(`${baseUrl}/administration/users`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "用户" })).toBeVisible();
  const desktopList = page.getByLabel("桌面列表");
  await expect(desktopList.getByText("alice", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "新建用户" }).click();
  const createDialog = page.getByRole("dialog", { name: "新建用户" });
  await createDialog.getByLabel("用户名").fill(createdUsername);
  await createDialog.getByLabel("邮箱").fill(createdEmail);
  await createDialog.getByLabel("初始密码").fill("a-safe-e2e-password");
  await createDialog.getByRole("button", { name: /创\s*建/ }).click();

  await expect(createDialog).toHaveCount(0);
  await expect(desktopList.getByText(createdUsername, { exact: true })).toBeVisible();
  expect(receivedPasswords).toEqual(["a-safe-e2e-password"]);
  await expect(page.getByText("a-safe-e2e-password", { exact: true })).toHaveCount(0);

  await desktopList.getByRole("button", { name: "更改状态" }).first().click();
  const statusDialog = page.getByRole("dialog", { name: "更改用户状态" });
  await statusDialog.getByRole("combobox").click();
  await page.getByText("锁定", { exact: true }).last().click();
  await statusDialog.getByRole("button", { name: /保\s*存\s*状态/ }).click();

  await expect(statusDialog).toHaveCount(0);
  await expect(desktopList.getByText("锁定", { exact: true })).toBeVisible();
  await desktopList
    .getByRole("button", { name: /删\s*除/ })
    .first()
    .click();
  const confirmation = page.getByRole("tooltip", { name: "删除用户“alice”？" });
  await confirmation.getByRole("button", { name: /删\s*除/ }).click();

  await expect(desktopList.getByText("alice", { exact: true })).toHaveCount(0);
});

test.describe("user administration responsive layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("renders typed user results as mobile cards", async ({ page }) => {
    await page.route("**/api/v1/authorization/me", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          actorId: 900001,
          authorities: ["users:read"],
          dataScopes: {},
          roles: [],
        },
      });
    });
    await page.route("**/api/v1/navigation", async (route) => {
      await route.fulfill({ contentType: "application/json", json: [] });
    });
    await page.route("**/api/v1/users*", async (route) => {
      expect(route.request().method()).toBe("GET");
      await route.fulfill({
        contentType: "application/json",
        json: { objectList: [initialUser], pageNum: 1, pageSize: 20, totalNum: 1 },
      });
    });
    await page.addInitScript(() => {
      sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
      sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
    });

    await page.goto(`${baseUrl}/administration/users`, { waitUntil: "networkidle" });

    await expect(page.getByLabel("移动列表").getByText("Alice", { exact: true })).toBeVisible();
    await expect(page.getByLabel("桌面列表")).toBeHidden();
    await expect(page.getByRole("button", { name: "更改状态" })).toHaveCount(0);
  });
});
