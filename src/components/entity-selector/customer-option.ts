import { recordOf } from "~/shared/utils/decode";

export interface CustomerOption {
  id: number;
  name: string;
}

/** Decodes only the stable ID and name from a server-visible customer page. */
export function decodeCustomerOptions(value: unknown): readonly CustomerOption[] {
  const objectList = recordOf(value)?.objectList;
  if (!Array.isArray(objectList)) {
    throw new Error("客户选择数据暂时不可用，请稍后重试。");
  }

  const known = new Set<number>();
  return objectList.flatMap((item) => {
    const customer = recordOf(item);
    const id = customer?.id;
    const name = customer?.name;
    if (
      typeof id !== "number" ||
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof name !== "string" ||
      name.trim().length === 0 ||
      known.has(id)
    ) {
      return [];
    }

    known.add(id);
    return [{ id, name }];
  });
}
