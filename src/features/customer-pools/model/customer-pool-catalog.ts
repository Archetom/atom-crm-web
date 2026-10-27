import type { components } from "~/api/generated/schema";

export type CustomerPoolStatus = "ACTIVE" | "INACTIVE" | "DELETED";

export interface CustomerPoolCatalogItem {
  id: number;
  name: string;
  status: CustomerPoolStatus;
  customerCount: number;
  administrator: boolean;
}

function identifier(value: number | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonNegativeInteger(value: number | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isStatus(value: string | undefined): value is CustomerPoolStatus {
  return value === "ACTIVE" || value === "INACTIVE" || value === "DELETED";
}

/**
 * Catalog responses are the server's only source of accessible pool scope.
 * This UI projection rejects incomplete generated responses instead of filling
 * gaps from local identities, authorities, or cached configuration records.
 */
export function decodeCustomerPoolCatalog(
  value: readonly components["schemas"]["CustomerPoolResponse"][],
): readonly CustomerPoolCatalogItem[] {
  const identifiers = new Set<number>();
  return value.map((item) => {
    const id = identifier(item.id);
    const customerCount = nonNegativeInteger(item.customerCount);
    if (
      id === null ||
      typeof item.name !== "string" ||
      item.name.trim().length === 0 ||
      !isStatus(item.status) ||
      customerCount === null ||
      typeof item.administrator !== "boolean" ||
      identifiers.has(id)
    ) {
      throw new Error("客户公海目录数据暂时不可用，请稍后重试。");
    }

    identifiers.add(id);
    return {
      id,
      name: item.name,
      status: item.status,
      customerCount,
      administrator: item.administrator,
    };
  });
}
