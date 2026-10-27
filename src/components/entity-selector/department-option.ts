import { recordOf } from "~/shared/utils/decode";

export interface DepartmentOption {
  departmentId: number;
  name: string;
}

/** Decodes only active, server-visible departments for entity selection. */
export function decodeDepartmentOptions(value: unknown): readonly DepartmentOption[] {
  if (!Array.isArray(value)) {
    throw new Error("部门选择数据暂时不可用，请稍后重试。");
  }

  const known = new Set<number>();
  return value.flatMap((item) => {
    const department = recordOf(item);
    const departmentId = department?.id;
    const name = department?.name;
    if (
      department === null ||
      typeof departmentId !== "number" ||
      !Number.isSafeInteger(departmentId) ||
      departmentId <= 0 ||
      typeof name !== "string" ||
      name.trim().length === 0 ||
      department.active !== true ||
      known.has(departmentId)
    ) {
      return [];
    }

    known.add(departmentId);
    return [{ departmentId, name }];
  });
}
