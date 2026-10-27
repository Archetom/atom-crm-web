import { describe, expect, it } from "vitest";

import {
  hasValidWorkTaskReminderSteps,
  toWorkTaskReminderPlan,
  toWorkTaskSeriesReminderPlan,
} from "./work-task-reminder-plan";

describe("toWorkTaskReminderPlan", () => {
  it("keeps only a complete versioned task reminder plan", () => {
    expect(
      toWorkTaskReminderPlan({
        notificationProjectionVersion: 8,
        seriesId: null,
        steps: [
          {
            offsetMinutes: 30,
            recipientRoles: ["FOLLOWERS", "ASSIGNEE"],
            stepKey: "ignored",
            timing: "BEFORE_DUE",
          },
          {
            offsetMinutes: 0,
            recipientRoles: ["CREATOR"],
            stepKey: "ignored-too",
            timing: "AT_DUE",
          },
        ],
        taskId: 6,
        version: 4,
      }),
    ).toEqual({
      steps: [
        {
          offsetMinutes: 30,
          recipientRoles: ["ASSIGNEE", "FOLLOWERS"],
          timing: "BEFORE_DUE",
        },
        { offsetMinutes: 0, recipientRoles: ["CREATOR"], timing: "AT_DUE" },
      ],
      taskId: 6,
      version: 4,
    });
  });

  it("fails closed for an invalid, duplicate, or series reminder plan", () => {
    expect(
      toWorkTaskReminderPlan({
        seriesId: null,
        steps: [
          { offsetMinutes: 0, recipientRoles: ["ASSIGNEE"], timing: "AT_DUE" },
          { offsetMinutes: 0, recipientRoles: ["ASSIGNEE"], timing: "AT_DUE" },
        ],
        taskId: 6,
        version: 4,
      }),
    ).toBeNull();
    expect(
      hasValidWorkTaskReminderSteps([
        { offsetMinutes: 0, recipientRoles: ["ASSIGNEE"], timing: "AT_DUE" },
        { offsetMinutes: 0, recipientRoles: ["ASSIGNEE"], timing: "AT_DUE" },
      ]),
    ).toBe(false);
    expect(
      toWorkTaskReminderPlan({
        seriesId: 9,
        steps: [],
        taskId: 6,
        version: 4,
      }),
    ).toBeNull();
  });

  it("keeps only a complete versioned future-series reminder template", () => {
    expect(
      toWorkTaskSeriesReminderPlan({
        notificationProjectionVersion: 8,
        seriesId: 9,
        steps: [
          {
            offsetMinutes: 15,
            recipientRoles: ["FOLLOWERS", "ASSIGNEE"],
            stepKey: "ignored",
            timing: "OVERDUE",
          },
        ],
        taskId: null,
        version: 4,
      }),
    ).toEqual({
      seriesId: 9,
      steps: [{ offsetMinutes: 15, recipientRoles: ["ASSIGNEE", "FOLLOWERS"], timing: "OVERDUE" }],
      version: 4,
    });
  });

  it("fails closed when a future-series template has a task identity", () => {
    expect(
      toWorkTaskSeriesReminderPlan({
        seriesId: 9,
        steps: [],
        taskId: 6,
        version: 4,
      }),
    ).toBeNull();
  });
});
