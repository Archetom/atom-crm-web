import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/production",
  reporter: "list",
  use: {
    baseURL: process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://127.0.0.1:18089",
    trace: "retain-on-failure",
  },
  workers: 1,
});
