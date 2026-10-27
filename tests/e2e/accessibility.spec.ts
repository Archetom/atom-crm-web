import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import type { NavigationItem } from "~/shared/types/api";

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

type NavigationEntry = readonly [code: string, titleKey: string, route: string];

function navigationSection(
  code: string,
  titleKey: string,
  order: number,
  entries: readonly NavigationEntry[],
): NavigationItem {
  return {
    children: entries.map(([childCode, childTitleKey, route], index) => ({
      children: [],
      code: childCode,
      order: index + 1,
      parentCode: code,
      requiredAuthority: null,
      route,
      titleKey: childTitleKey,
    })),
    code,
    order,
    parentCode: null,
    requiredAuthority: null,
    route: null,
    titleKey,
  };
}

const completeNavigation: NavigationItem[] = [
  navigationSection("workspace", "navigation.workspace", 1, [
    ["workspace.home", "navigation.home", "/"],
  ]),
  navigationSection("crm", "navigation.crm", 2, [
    ["crm.customers", "navigation.customers", "/crm/customers"],
    ["crm.customer-pools", "navigation.customerPools", "/crm/customer-pools"],
    ["crm.leads", "navigation.leads", "/crm/leads"],
    ["crm.contacts", "navigation.contacts", "/crm/contacts"],
    ["crm.contact-pools", "navigation.contactPools", "/crm/contact-pools"],
    ["crm.opportunities", "navigation.opportunities", "/crm/opportunities"],
    ["crm.products", "navigation.products", "/crm/products"],
  ]),
  navigationSection("marketing", "navigation.marketing", 3, [
    ["marketing.forms", "navigation.marketingForms", "/marketing/forms"],
  ]),
  navigationSection("oa", "navigation.oa", 4, [
    ["oa.forms", "navigation.oaForms", "/oa/forms"],
    ["oa.requests", "navigation.oaRequests", "/oa/requests"],
    ["oa.announcements", "navigation.oaAnnouncements", "/oa/announcements"],
  ]),
  navigationSection("organization", "navigation.organization", 5, [
    ["organization.departments", "navigation.departments", "/organization/departments"],
    ["organization.members", "navigation.members", "/organization/members"],
  ]),
  navigationSection("administration", "navigation.administration", 6, [
    ["administration.users", "navigation.users", "/administration/users"],
    ["administration.roles", "navigation.roles", "/administration/roles"],
    ["administration.fields", "navigation.fields", "/administration/fields"],
    ["administration.embedded-pages", "navigation.embeddedPages", "/administration/embedded-pages"],
  ]),
];

function setDevelopmentIdentity() {
  sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
  sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
}

function captureRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function expectNoWcagViolations(page: Page, selector?: string) {
  const audit = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]);
  if (selector) audit.include(selector);
  const results = await audit.analyze();

  expect(
    results.violations.map((violation) => ({
      help: violation.help,
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

async function mockUserAdministrationBootstrap(page: Page, navigation: NavigationItem[] = []) {
  await page.route("**/api/v1/authorization/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        actorId: 900001,
        authorities: ["users:read", "users:write"],
        dataScopes: {},
        roles: [],
      },
    });
  });
  await page.route("**/api/v1/navigation", async (route) => {
    await route.fulfill({ contentType: "application/json", json: navigation });
  });
  await page.route("**/api/v1/users*", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({
      contentType: "application/json",
      json: { objectList: [initialUser], pageNum: 1, pageSize: 20, totalNum: 1 },
    });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
}

async function mockCustomerPoolBootstrap(page: Page) {
  await page.route("**/api/v1/authorization/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        actorId: 900001,
        authorities: ["customer-pools:read", "customer-pools:manage"],
        dataScopes: {},
        roles: [],
      },
    });
  });
  await page.route("**/api/v1/navigation", async (route) => {
    await route.fulfill({ contentType: "application/json", json: [] });
  });
  await page.route("**/api/v1/customer-pools/catalog", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({
      contentType: "application/json",
      json: [
        {
          administrator: true,
          customerCount: 3,
          id: 8,
          name: "华东客户公海",
          status: "ACTIVE",
        },
      ],
    });
  });
}

test("development session page satisfies WCAG A/AA without runtime errors", async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto(`${baseUrl}/dev/session`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "开发身份" })).toBeVisible();
  await expectNoWcagViolations(page);
  expect(runtimeErrors).toEqual([]);
});

test.describe("desktop accessibility", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("authorized user administration page and create form satisfy WCAG A/AA", async ({
    page,
  }) => {
    const runtimeErrors = captureRuntimeErrors(page);
    await mockUserAdministrationBootstrap(page);
    await page.addInitScript(setDevelopmentIdentity);
    await page.goto(`${baseUrl}/administration/users`, { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "用户" })).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    const skipLink = page.getByRole("link", { name: "跳到主要内容" });
    await skipLink.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    await expectNoWcagViolations(page);
    await page.getByRole("button", { name: "新建用户" }).click();
    const dialog = page.getByRole("dialog", { name: "新建用户" });
    await expect(dialog).toBeVisible();
    await page.waitForFunction(() => {
      const activeDialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      return activeDialog !== null && getComputedStyle(activeDialog).opacity === "1";
    });
    await expectNoWcagViolations(page, '[role="dialog"][aria-modal="true"]');
    expect(runtimeErrors).toEqual([]);
  });
});

test("complete server navigation remains reachable without horizontal overflow at wide and medium widths", async ({
  page,
}) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockUserAdministrationBootstrap(page, completeNavigation);
  await page.addInitScript(setDevelopmentIdentity);
  await page.goto(`${baseUrl}/administration/users`, { waitUntil: "networkidle" });

  const navigation = page.getByRole("navigation", { name: "主模块导航" });
  await expect(page.getByRole("heading", { name: "用户" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开导航" })).toBeHidden();
  await expect(page.getByRole("button", { name: "打开应用模块" })).toBeVisible();
  await expect(page.locator(".ant-layout-header")).toHaveCSS("height", "56px");
  await expect(page.locator(".ant-layout-sider")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expect
    .poll(() => navigation.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.getByRole("button", { name: "打开导航" })).toBeHidden();
  await expect(page.getByRole("button", { name: "打开应用模块" })).toBeVisible();
  await expect(page.locator(".ant-layout-sider")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expect
    .poll(() => navigation.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test.describe("tablet accessibility", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("customer-pool catalog retains one main landmark and satisfies WCAG A/AA", async ({
    page,
  }) => {
    const runtimeErrors = captureRuntimeErrors(page);
    await mockCustomerPoolBootstrap(page);
    await page.addInitScript(setDevelopmentIdentity);
    await page.goto(`${baseUrl}/crm/customer-pools`, { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "客户公海" })).toBeVisible();
    await expect(page.getByText("华东客户公海", { exact: true })).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expectNoWcagViolations(page);
    expect(runtimeErrors).toEqual([]);
  });
});

test.describe("mobile accessibility", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("navigation drawer is keyboard operable and the users page satisfies WCAG A/AA", async ({
    page,
  }) => {
    const runtimeErrors = captureRuntimeErrors(page);
    await mockUserAdministrationBootstrap(page);
    await page.addInitScript(setDevelopmentIdentity);
    await page.goto(`${baseUrl}/administration/users`, { waitUntil: "networkidle" });

    const openNavigation = page.getByRole("button", { name: "打开导航" });
    await expect(openNavigation).toBeVisible();
    await openNavigation.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(openNavigation).toBeFocused();
    await expectNoWcagViolations(page);
    expect(runtimeErrors).toEqual([]);
  });
});
