import type {
  GlobalRecordListRelationFilter,
  GlobalRecordListRelationOption,
} from "~/components/data-view/global-record-list-relation-filter";

import type { ProductCategory } from "./product-category";

function collectCategoryOptions(
  categories: readonly ProductCategory[],
  prefix: readonly string[],
  target: GlobalRecordListRelationOption[],
): void {
  for (const category of categories) {
    const path = [...prefix, category.name];
    target.push({ id: category.id, name: path.join(" / ") });
    collectCategoryOptions(category.children, path, target);
  }
}

/** Flattens the server-validated category tree for a list-only relation selector. */
export function productCategoryOptions(
  categories: readonly ProductCategory[],
): readonly GlobalRecordListRelationOption[] {
  const options: GlobalRecordListRelationOption[] = [];
  collectCategoryOptions(categories, [], options);
  return options;
}

export function findProductCategoryOption(
  categories: readonly ProductCategory[],
  categoryId: number,
): GlobalRecordListRelationOption | null {
  return productCategoryOptions(categories).find((category) => category.id === categoryId) ?? null;
}

/** Uses the read-only server category directory to constrain product-list category queries. */
export const productCategoryRelationFilter: GlobalRecordListRelationFilter = {
  authority: "products:read",
  label: "产品分类",
  parameter: "categoryId",
  loadOptions: async (apiClient, keyword) => {
    const candidates = productCategoryOptions(await apiClient.getProductCategories());
    const normalizedKeyword = keyword.trim();
    return normalizedKeyword === ""
      ? candidates
      : candidates.filter((category) => category.name.includes(normalizedKeyword));
  },
  resolveOption: async (apiClient, categoryId) => {
    const category = findProductCategoryOption(await apiClient.getProductCategories(), categoryId);
    if (category === null) throw new Error("所选产品分类暂时无法确认，请重新选择");
    return category;
  },
};
