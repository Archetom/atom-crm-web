import { recordOf } from "~/shared/utils/decode";

export interface OpportunityProductBaselineLine {
  productId: number;
  productName: string;
  productCode: string | null;
  categoryName: string | null;
  unit: string | null;
  quantity: number;
  unitPrice: number;
}

export interface OpportunityProductBaseline {
  opportunityId: number;
  version: number;
  lines: readonly OpportunityProductBaselineLine[];
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function safeNonNegativeAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

function safePositiveQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

/**
 * The products endpoint is a complete, versioned server snapshot when the
 * PRODUCT relation and its price source fields are readable. Do not use the
 * money-free detail projection as a replacement input.
 */
export function decodeOpportunityProductBaseline(value: unknown): OpportunityProductBaseline {
  const source = recordOf(value);
  const opportunityId = source?.opportunityId;
  const version = source?.version;
  const rawLines = source?.lines;
  if (
    source === null ||
    typeof opportunityId !== "number" ||
    !Number.isSafeInteger(opportunityId) ||
    opportunityId <= 0 ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    !Array.isArray(rawLines)
  ) {
    throw new Error("商机产品完整基线暂时不可用，请稍后重试。");
  }

  const productIds = new Set<number>();
  const lines = rawLines.map((value) => {
    const line = recordOf(value);
    const productId = line?.productId;
    const productName = optionalText(line?.productName);
    const quantity = line?.quantity;
    const unitPrice = line?.unitPrice;
    if (
      line === null ||
      typeof productId !== "number" ||
      !Number.isSafeInteger(productId) ||
      productId <= 0 ||
      productName === null ||
      !safePositiveQuantity(quantity) ||
      !safeNonNegativeAmount(unitPrice) ||
      productIds.has(productId)
    ) {
      throw new Error("商机产品完整基线暂时不可用，请稍后重试。");
    }
    productIds.add(productId);
    return {
      productId,
      productName,
      productCode: optionalText(line.productCode),
      categoryName: optionalText(line.categoryName),
      unit: optionalText(line.unit),
      quantity,
      unitPrice,
    };
  });

  return { lines, opportunityId, version };
}
