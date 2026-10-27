import { recordOf } from "~/shared/utils/decode";

export interface ProductCategory {
  id: number;
  parentCategoryId: number | null;
  name: string;
  status: string;
  version: number;
  children: readonly ProductCategory[];
}

export interface ProductCategoryOption {
  label: string;
  value: number;
}

/** Builds a readable flat selector from the already authorized category tree. */
export function productCategoryOptions(
  categories: readonly ProductCategory[],
  prefix = "",
): ProductCategoryOption[] {
  return categories.flatMap((category) => [
    { label: `${prefix}${category.name}`, value: category.id },
    ...productCategoryOptions(category.children, `${prefix}${category.name} / `),
  ]);
}

const maximumCategoryDepth = 16;

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function decodeCategory(value: unknown, depth: number): ProductCategory | null {
  if (depth > maximumCategoryDepth) return null;

  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const parentCategoryId =
    source.parentCategoryId === null || source.parentCategoryId === undefined
      ? null
      : positiveIdentifier(source.parentCategoryId);
  const version =
    typeof source.version === "number" &&
    Number.isSafeInteger(source.version) &&
    source.version >= 0
      ? source.version
      : null;
  const name =
    typeof source.name === "string" && source.name.trim().length > 0 ? source.name : null;
  const status =
    typeof source.status === "string" && source.status.trim().length > 0 ? source.status : null;
  const childValues = source.children === undefined ? [] : source.children;
  const hasInvalidParent =
    parentCategoryId === null &&
    source.parentCategoryId !== null &&
    source.parentCategoryId !== undefined;
  if (id === null || hasInvalidParent || version === null || name === null || status === null) {
    return null;
  }
  if (!Array.isArray(childValues)) {
    return null;
  }

  const children: ProductCategory[] = [];
  for (const childValue of childValues) {
    const child = decodeCategory(childValue, depth + 1);
    if (child === null) return null;
    children.push(child);
  }

  return {
    id,
    parentCategoryId,
    name,
    status,
    version,
    children,
  };
}

/** Decodes the opaque, server-governed product-category tree. */
export function decodeProductCategoryTree(value: unknown): readonly ProductCategory[] {
  if (!Array.isArray(value)) {
    throw new Error("产品分类目录数据暂时不可用，请稍后重试。");
  }

  const categories: ProductCategory[] = [];
  for (const categoryValue of value) {
    const category = decodeCategory(categoryValue, 1);
    if (category === null) throw new Error("产品分类目录数据暂时不可用，请稍后重试。");
    categories.push(category);
  }

  return categories;
}

/** Decodes one opaque product-category mutation response. */
export function decodeProductCategory(value: unknown): ProductCategory | null {
  return decodeCategory(value, 1);
}
