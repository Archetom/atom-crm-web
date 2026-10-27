import { expect, test } from "@playwright/test";

import type { components } from "../../src/api/generated/schema";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const headers = {
  "X-Dev-Tenant-Id": "900001",
  "X-Dev-User-Id": "900001",
};

type SavedView = components["schemas"]["SavedViewResponse"];

test("lead advanced filter opens conditions directly and preserves saved-view management", async ({
  page,
}) => {
  const viewName = `E2E Direct Advanced Filter ${Date.now()}`;

  async function removeTestView() {
    const response = await page.request.get(
      `${baseUrl}/api/v1/saved-views?includeHidden=true&objectType=LEAD`,
      { headers },
    );
    if (!response.ok()) return;
    const views = (await response.json()) as SavedView[];
    const view = views.find((candidate) => candidate.name === viewName);
    if (view === undefined) return;
    await page.request.delete(`${baseUrl}/api/v1/saved-views/${view.id}?version=${view.version}`, {
      headers,
    });
  }

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/leads`, { waitUntil: "networkidle" });

  try {
    await page.getByRole("button", { name: "高级筛选", exact: true }).click();

    const advancedDialog = page.getByRole("dialog", { name: "高级筛选" });
    await expect(advancedDialog).toBeVisible();
    await expect(
      advancedDialog.getByRole("button", { name: "添加筛选条件", exact: true }),
    ).toBeVisible();
    const saveAsView = advancedDialog.getByRole("checkbox", {
      name: "保存为筛选方案",
      exact: true,
    });
    await expect(saveAsView).toBeVisible();
    await expect(advancedDialog.getByRole("button", { name: /确\s*定/u })).toBeVisible();
    await expect(page.getByRole("button", { name: "临时应用筛选", exact: true })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(advancedDialog).toHaveCount(0);

    await page.getByRole("button", { name: "高级筛选", exact: true }).click();
    await saveAsView.check();
    const defaultView = advancedDialog.getByRole("checkbox", {
      name: "设置为默认",
      exact: true,
    });
    await expect(defaultView).toBeVisible();
    await defaultView.check();
    await advancedDialog.getByLabel("筛选方案名称", { exact: true }).fill(viewName);
    await advancedDialog.getByRole("button", { name: /确\s*定/u }).click();
    await expect(advancedDialog).toHaveCount(0);

    await expect
      .poll(async () => {
        const response = await page.request.get(
          `${baseUrl}/api/v1/saved-views?includeHidden=true&objectType=LEAD`,
          { headers },
        );
        if (!response.ok()) return false;
        const views = (await response.json()) as SavedView[];
        return views.some((candidate) => candidate.defaultView && candidate.name === viewName);
      })
      .toBe(true);

    await page.getByRole("button", { name: "筛选方案", exact: true }).click();
    const managerDialog = page.getByRole("dialog", { name: "线索筛选方案" });
    await expect(managerDialog).toBeVisible();
    await expect(managerDialog.getByText(viewName, { exact: true })).toBeVisible();
    await expect(managerDialog.getByRole("button", { name: /新建筛选方案/u })).toBeVisible();
  } finally {
    await removeTestView();
  }
});

test("lead saved view exposes only published conditions for expanded filtering", async ({
  page,
}) => {
  const viewName = `E2E Exposed Saved View ${Date.now()}`;

  async function removeTestView() {
    const response = await page.request.get(
      `${baseUrl}/api/v1/saved-views?includeHidden=true&objectType=LEAD`,
      { headers },
    );
    if (!response.ok()) return;
    const views = (await response.json()) as SavedView[];
    const view = views.find((candidate) => candidate.name === viewName);
    if (view === undefined) return;
    await page.request.delete(`${baseUrl}/api/v1/saved-views/${view.id}?version=${view.version}`, {
      headers,
    });
  }

  const createResponse = await page.request.post(`${baseUrl}/api/v1/saved-views`, {
    data: {
      conditions: [
        {
          exposed: true,
          fieldCode: "lead_name",
          operator: "CONTAINS",
          values: ["Atom"],
        },
      ],
      name: viewName,
      objectType: "LEAD",
    },
    headers,
  });
  expect(createResponse.ok()).toBe(true);
  const savedView = (await createResponse.json()) as SavedView;

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });

  try {
    await page.goto(`${baseUrl}/crm/leads?savedView=${savedView.id}`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: "展开筛选", exact: true }).click();
    await expect(page.getByLabel("条件 1 的值 1", { exact: true })).toHaveValue("Atom");
    await expect(page.getByText("高级筛选：1 条", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "清除外露筛选", exact: true }).click();
    await expect(page.getByText("高级筛选：1 条", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "收起筛选", exact: true }).click();
    await expect(page.getByRole("button", { name: "展开筛选", exact: true })).toBeVisible();
  } finally {
    await removeTestView();
  }
});
