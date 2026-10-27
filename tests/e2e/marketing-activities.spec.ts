import { expect, test } from "@playwright/test";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";

test("marketing activity keeps the list context across create, detail, edit, and delete", async ({
  page,
}) => {
  const suffix = Date.now();
  const activityName = `E2E Marketing Activity ${suffix}`;
  const updatedActivityType = `E2E Roadshow ${suffix}`;

  await page.addInitScript(() => {
    sessionStorage.setItem("atom-crm.dev.actor-id", "900001");
    sessionStorage.setItem("atom-crm.dev.tenant-id", "900001");
  });
  await page.goto(`${baseUrl}/crm/marketing-activities?keyword=E2E&page=1`, {
    waitUntil: "networkidle",
  });

  await expect(page.getByRole("heading", { name: "市场活动管理" })).toBeVisible();
  await page.getByRole("button", { name: "新建活动" }).click();
  const createDialog = page.getByRole("dialog", { name: "新建市场活动" });
  await createDialog.getByLabel("活动名称").fill(activityName);
  const dateInputs = createDialog.locator(".ant-picker-input input");
  await dateInputs.nth(0).fill("2026-09-01 09:00:00");
  await dateInputs.nth(0).press("Tab");
  await dateInputs.nth(1).fill("2026-09-01 17:00:00");
  await dateInputs.nth(1).press("Tab");

  const [createResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/marketing-activities" &&
        response.request().method() === "POST",
    ),
    createDialog.getByRole("button", { name: /保\s*存/u }).click(),
  ]);
  expect(createResponse.ok()).toBeTruthy();
  const createPayload = createResponse.request().postDataJSON() as {
    name?: unknown;
    participantActorIds?: unknown;
    submissionCount?: unknown;
    viewCount?: unknown;
  };
  expect(createPayload).toMatchObject({
    name: activityName,
    participantActorIds: [900001],
    submissionCount: 0,
    viewCount: 0,
  });

  await expect(createDialog).toBeHidden();
  await expect(page.getByRole("button", { name: activityName })).toBeVisible();
  await page.getByRole("button", { name: activityName }).click();
  await expect(page).toHaveURL(/activityId=\d+/);
  const detailDrawer = page.getByRole("dialog", { name: "市场活动详情" });
  await expect(detailDrawer.getByText(activityName, { exact: true })).toBeVisible();

  await detailDrawer.getByRole("button", { name: /编\s*辑/u }).click();
  const editDialog = page.getByRole("dialog", { name: "编辑市场活动" });
  await editDialog.getByLabel("活动类型").fill(updatedActivityType);
  const [updateResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        /^\/api\/v1\/marketing-activities\/\d+$/u.test(new URL(response.url()).pathname) &&
        response.request().method() === "PUT",
    ),
    editDialog.getByRole("button", { name: /保\s*存/u }).click(),
  ]);
  expect(updateResponse.ok()).toBeTruthy();
  const updatePayload = updateResponse.request().postDataJSON() as { activityType?: unknown };
  expect(updatePayload).toMatchObject({ activityType: updatedActivityType });

  await expect(editDialog).toBeHidden();
  await expect(detailDrawer.getByText(updatedActivityType, { exact: true })).toBeVisible();
  await detailDrawer.getByRole("button", { name: /删\s*除/u }).click();
  const deleteConfirmation = page.getByRole("tooltip", { name: "确认删除此市场活动？" });
  const [deleteResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        /^\/api\/v1\/marketing-activities\/\d+$/u.test(new URL(response.url()).pathname) &&
        response.request().method() === "DELETE",
    ),
    deleteConfirmation.getByRole("button", { name: /删\s*除/u }).click(),
  ]);
  expect(deleteResponse.ok()).toBeTruthy();

  await expect(detailDrawer).toBeHidden();
  await expect(page).toHaveURL(/keyword=E2E/);
  await expect(page).not.toHaveURL(/activityId=/);
  await expect(page.getByRole("button", { name: activityName })).toBeHidden();
});
