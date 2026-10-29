import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/installation", (route) =>
    route.fulfill({ json: { installationRequired: false } }),
  );
});

test("production container hydrates and loads a second route under its CSP", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  const policy = response?.headers()["content-security-policy"];
  expect(policy).toContain("script-src 'self' 'sha256-");
  expect(policy).not.toMatch(/script-src[^;]*'unsafe-(?:inline|eval)'/u);
  expect(response?.headers()["cache-control"]).toBe("no-store");

  await expect(page.getByRole("heading", { name: "登录工作空间" })).toBeVisible();
  await expect(page.getByLabel("登录账号")).toBeEditable();
  await page.getByRole("link", { name: "忘记密码？" }).click();
  await expect(page).toHaveURL(/\/password-reset$/u);
  await expect(page.getByRole("button", { name: "发送重置链接" })).toBeVisible();
  await page.getByRole("link", { name: "返回登录" }).click();
  await expect(page.getByRole("heading", { name: "登录工作空间" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("production CSP blocks inline scripts outside the build hash allowlist", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "登录工作空间" })).toBeVisible();

  const blockedDirective = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        document.addEventListener(
          "securitypolicyviolation",
          (event) => resolve(event.effectiveDirective),
          { once: true },
        );
        const script = document.createElement("script");
        script.textContent = 'document.body.dataset.untrustedScript = "executed";';
        document.body.append(script);
      }),
  );

  expect(blockedDirective).toBe("script-src-elem");
  await expect(page.locator("body")).not.toHaveAttribute("data-untrusted-script");
});
