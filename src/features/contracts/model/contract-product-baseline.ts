import { recordOf } from "~/shared/utils/decode";

export interface ContractProductBaselineLine {
  productId: number;
  productName: string;
  productCode: string;
  categoryName: string | null;
  unit: string | null;
  quantity: number;
  unitPrice: number;
}

export interface ContractProductBaseline {
  contractId: number;
  version: number;
  lines: readonly ContractProductBaselineLine[];
}

function requiredText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
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
 * The dedicated contract products endpoint is the only complete, versioned
 * source that may initialize a relation replacement. Normal contract detail
 * deliberately has no product price data and is never a mutation baseline.
 */
export function decodeContractProductBaseline(value: unknown): ContractProductBaseline {
  const source = recordOf(value);
  const contractId = source?.contractId;
  const version = source?.version;
  const rawLines = source?.lines;
  if (
    source === null ||
    typeof contractId !== "number" ||
    !Number.isSafeInteger(contractId) ||
    contractId <= 0 ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    !Array.isArray(rawLines)
  ) {
    throw new Error("合同产品完整基线暂时不可用，请稍后重试。");
  }

  const productIds = new Set<number>();
  const lines = rawLines.map((value) => {
    const line = recordOf(value);
    const productId = line?.productId;
    const productName = requiredText(line?.productName);
    const productCode = requiredText(line?.productCode);
    const quantity = line?.quantity;
    const unitPrice = line?.unitPrice;
    if (
      line === null ||
      typeof productId !== "number" ||
      !Number.isSafeInteger(productId) ||
      productId <= 0 ||
      productName === null ||
      productCode === null ||
      !safePositiveQuantity(quantity) ||
      !safeNonNegativeAmount(unitPrice) ||
      productIds.has(productId)
    ) {
      throw new Error("合同产品完整基线暂时不可用，请稍后重试。");
    }
    productIds.add(productId);
    return {
      productId,
      productName,
      productCode,
      categoryName: optionalText(line.categoryName),
      unit: optionalText(line.unit),
      quantity,
      unitPrice,
    };
  });

  return { contractId, lines, version };
}
