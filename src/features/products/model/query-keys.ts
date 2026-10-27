import { createEntityQueryKeys } from "~/api/query-keys/entity";
import type { components } from "~/api/generated/schema";

const entityKeys = createEntityQueryKeys("products");

export const productKeys = {
  ...entityKeys,
  attachments: (identityKey: string, productId: number) =>
    [...entityKeys.all, "attachments", identityKey, productId] as const,
  productImages: (identityKey: string, productId: number) =>
    [...entityKeys.all, "product-images", identityKey, productId] as const,
  productImageGroup: (identityKey: string, productId: number, imageType: "PRIMARY" | "DETAIL") =>
    [...productKeys.productImages(identityKey, productId), imageType] as const,
  listRequest: (identityKey: string, query: components["schemas"]["ProductQueryRequest"]) =>
    entityKeys.list(identityKey, {
      availability: query.availability,
      categoryId: query.categoryId,
      code: query.code,
      keyword: query.keyword,
      name: query.name,
      ownerActorId: query.ownerActorId,
      page: query.page,
      savedViewId: query.savedViewId,
      size: query.size,
      sortDirection: query.sortDirection,
      sortField: query.sortField,
    }),
  temporaryFilteredList: (
    identityKey: string,
    query: components["schemas"]["ProductQueryRequest"],
  ) => {
    const { conditions = [], ...criteria } = query;
    return [...entityKeys.all, "list", identityKey, criteria, conditions] as const;
  },
};

export const productEditableBaselineKey = (identityKey: string, productId: number) =>
  ["products", "editable-baseline", identityKey, productId] as const;

export const productCategoryKeys = {
  all: ["product-categories"] as const,
  tree: (identityKey: string) => ["product-categories", "tree", identityKey] as const,
};
