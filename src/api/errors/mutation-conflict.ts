import { ApiError } from "./api-error";

export type MutationConflictKind =
  "version-conflict" | "concurrent-operation" | "resource-already-exists";

export interface MutationConflict {
  kind: MutationConflictKind;
  title: string;
  detail: string;
}

const conflicts: Record<MutationConflictKind, MutationConflict> = {
  "version-conflict": {
    kind: "version-conflict",
    title: "数据已被其他成员修改",
    detail: "请刷新数据后再继续操作，系统不会覆盖其他成员的更新。",
  },
  "concurrent-operation": {
    kind: "concurrent-operation",
    title: "操作正在被并发处理",
    detail: "请刷新数据确认最新状态后再决定下一步操作。",
  },
  "resource-already-exists": {
    kind: "resource-already-exists",
    title: "相同资源已存在",
    detail: "请检查已有记录后再提交，系统没有重复创建资源。",
  },
};

const conflictCodeKinds = {
  VERSION_CONFLICT: "version-conflict",
  CONCURRENT_OPERATION: "concurrent-operation",
  RESOURCE_ALREADY_EXISTS: "resource-already-exists",
} as const satisfies Record<string, MutationConflictKind>;

export function getMutationConflict(error: unknown): MutationConflict | null {
  if (!(error instanceof ApiError) || error.status !== 409 || error.code === undefined) return null;

  const kind = conflictCodeKinds[error.code as keyof typeof conflictCodeKinds];
  return kind === undefined ? null : conflicts[kind];
}

export function requiresConflictRefresh(conflict: MutationConflict): boolean {
  return conflict.kind !== "resource-already-exists";
}
