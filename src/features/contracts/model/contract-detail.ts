import {
  decodeControlledFileFields,
  type ControlledFileField,
} from "~/components/controlled-file-field/model";
import { decodeCustomFieldValues, type CustomFieldValues } from "~/components/dynamic-field";
import { recordOf } from "~/shared/utils/decode";

export interface ContractProductSnapshotLine {
  productId: number;
  productName: string;
  productCode: string | null;
  categoryName: string | null;
  unit: string | null;
  quantity: string | null;
}

export interface ContractDetail {
  id: number;
  version: number;
  customerId: number;
  opportunityId: number | null;
  contactId: number | null;
  ownerActorId: number | null;
  name: string | null;
  number: string | null;
  orderDate: string | null;
  startDate: string | null;
  endDate: string | null;
  contractType: string | null;
  paymentType: string | null;
  remark: string | null;
  status: string | null;
  /** Server-provided scalar custom values only; FILE values stay in fileFields. */
  customFields?: CustomFieldValues;
  fileFields: readonly ControlledFileField[];
  products: readonly ContractProductSnapshotLine[];
  createdTime: string | null;
  updatedTime: string | null;
}

function optionalPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function quantityText(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function toProductSnapshotLine(value: unknown): ContractProductSnapshotLine | null {
  const source = recordOf(value);
  if (source === null) return null;

  const productId = optionalPositiveNumber(source.productId);
  const productName = optionalText(source.productName);
  if (productId === null || productName === null) return null;

  return {
    productId,
    productName,
    productCode: optionalText(source.productCode),
    categoryName: optionalText(source.categoryName),
    unit: optionalText(source.unit),
    quantity: quantityText(source.quantity),
  };
}

function toProductSnapshot(value: unknown): readonly ContractProductSnapshotLine[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;

  const products: ContractProductSnapshotLine[] = [];
  for (const item of value) {
    const product = toProductSnapshotLine(item);
    if (product === null) return null;
    products.push(product);
  }
  return products;
}

/**
 * ContractResponse is a field-filtered server response. This is a money-free,
 * read-only projection: monetary contract fields and every product
 * price/discount/amount are deliberately discarded.
 */
export function toContractDetail(value: unknown): ContractDetail | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = optionalPositiveNumber(source.id);
  const customerId = optionalPositiveNumber(source.customerId);
  const version = source.version;
  const products = toProductSnapshot(source.products);
  if (
    id === null ||
    customerId === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    products === null
  ) {
    return null;
  }

  return {
    id,
    version,
    customerId,
    opportunityId: optionalPositiveNumber(source.opportunityId),
    contactId: optionalPositiveNumber(source.contactId),
    ownerActorId: optionalPositiveNumber(source.ownerActorId),
    name: optionalText(source.name),
    number: optionalText(source.number),
    orderDate: optionalText(source.orderDate),
    startDate: optionalText(source.startDate),
    endDate: optionalText(source.endDate),
    contractType: optionalText(source.contractType),
    paymentType: optionalText(source.paymentType),
    remark: optionalText(source.remark),
    status: optionalText(source.status),
    ...(source.customFields === undefined
      ? {}
      : { customFields: decodeCustomFieldValues(source.customFields) }),
    fileFields: decodeControlledFileFields(source.fileFields),
    products,
    createdTime: optionalText(source.createdTime),
    updatedTime: optionalText(source.updatedTime),
  };
}
