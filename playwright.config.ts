import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  reporter: "list",
  use: {
    baseURL: process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
  },
});
