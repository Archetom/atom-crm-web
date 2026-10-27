export const workTaskReminderKeys = {
  all: ["work-task-reminder-plan"] as const,
  task: (identityKey: string, taskId: number) =>
    ["work-task-reminder-plan", identityKey, taskId] as const,
  series: (identityKey: string, seriesId: number) =>
    ["work-task-reminder-plan", "series", identityKey, seriesId] as const,
};
