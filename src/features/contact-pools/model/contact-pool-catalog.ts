import { recordOf } from "~/shared/utils/decode";

export type ContactPoolStatus = "ACTIVE" | "INACTIVE" | "DELETED";

export interface ContactPoolCatalogItem {
  id: number;
  name: string;
  status: ContactPoolStatus;
  contactCount: number;
  administrator: boolean;
}

function identifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isStatus(value: unknown): value is ContactPoolStatus {
  return value === "ACTIVE" || value === "INACTIVE" || value === "DELETED";
}

/**
 * Catalog responses are the server's only source of accessible pool scope.
 * Reject a malformed response instead of silently inventing a partial catalog.
 */
export function decodeContactPoolCatalog(value: unknown): readonly ContactPoolCatalogItem[] {
  if (!Array.isArray(value)) {
    throw new Error("联系人公海目录数据暂时不可用，请稍后重试。");
  }

  const identifiers = new Set<number>();
  return value.map((value) => {
    const item = recordOf(value);
    const id = item === null ? null : identifier(item.id);
    const name = item?.name;
    const status = item?.status;
    const contactCount = item === null ? null : nonNegativeInteger(item.contactCount);
    const administrator = item?.administrator;
    if (
      item === null ||
      id === null ||
      typeof name !== "string" ||
      name.length === 0 ||
      !isStatus(status) ||
      contactCount === null ||
      typeof administrator !== "boolean" ||
      identifiers.has(id)
    ) {
      throw new Error("联系人公海目录数据暂时不可用，请稍后重试。");
    }

    identifiers.add(id);
    return { id, name, status, contactCount, administrator };
  });
}
