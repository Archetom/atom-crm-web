const workTaskBusinessRecordTypeLabels = {
  CONTACT: "联系人",
  CONTRACT: "合同",
  CUSTOMER: "客户",
  INVOICE: "发票",
  LEAD: "线索",
  OPPORTUNITY: "商机",
  RECEIVABLE: "回款",
  RECEIVABLE_PLAN: "回款计划",
} as const;

export type WorkTaskBusinessRecordType = keyof typeof workTaskBusinessRecordTypeLabels;

export interface WorkTaskBusinessRecord {
  objectType: WorkTaskBusinessRecordType;
  recordId: number;
}

export const workTaskBusinessRecordOptions: {
  label: string;
  value: WorkTaskBusinessRecordType;
}[] = Object.entries(workTaskBusinessRecordTypeLabels).map(([value, label]) => ({
  label,
  value: value as WorkTaskBusinessRecordType,
}));

export function isWorkTaskBusinessRecordType(value: unknown): value is WorkTaskBusinessRecordType {
  return typeof value === "string" && value in workTaskBusinessRecordTypeLabels;
}

export function workTaskBusinessRecordLabel(type: WorkTaskBusinessRecordType): string {
  return workTaskBusinessRecordTypeLabels[type];
}

/** Returns null for no link and undefined for an incomplete or unsafe link. */
export function toWorkTaskBusinessRecord(
  objectType: unknown,
  recordId: unknown,
): WorkTaskBusinessRecord | null | undefined {
  const typeMissing = objectType === undefined || objectType === null || objectType === "";
  const idMissing = recordId === undefined || recordId === null || recordId === "";
  if (typeMissing && idMissing) return null;
  if (
    !isWorkTaskBusinessRecordType(objectType) ||
    typeof recordId !== "number" ||
    !Number.isSafeInteger(recordId) ||
    recordId <= 0
  ) {
    return undefined;
  }
  return { objectType, recordId };
}
