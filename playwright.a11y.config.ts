import { defineConfig } from "@playwright/test";

const baseURL = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "accessibility.spec.ts",
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: process.env.ATOM_CRM_WEB_E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev --host 127.0.0.1",
        env: { VITE_ENABLE_DEV_AUTH: "true" },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: baseURL,
      },
  workers: 1,
});
