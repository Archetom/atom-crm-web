export const workTaskPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export type WorkTaskPriority = (typeof workTaskPriorities)[number];

export const workTaskPriorityOptions: Array<{ label: string; value: WorkTaskPriority }> = [
  { label: "低", value: "LOW" },
  { label: "普通", value: "NORMAL" },
  { label: "高", value: "HIGH" },
  { label: "紧急", value: "URGENT" },
];

export function isWorkTaskPriority(value: unknown): value is WorkTaskPriority {
  return value === "LOW" || value === "NORMAL" || value === "HIGH" || value === "URGENT";
}
