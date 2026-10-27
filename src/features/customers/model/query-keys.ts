import { createEntityQueryKeys } from "~/api/query-keys/entity";
import type { components } from "~/api/generated/schema";

const entityKeys = createEntityQueryKeys("customers");

export const customerKeys = {
  ...entityKeys,
  listRequest: (identityKey: string, query: components["schemas"]["CustomerQueryRequest"]) =>
    entityKeys.list(identityKey, {
      keyword: query.keyword,
      name: query.name,
      ownerActorId: query.ownerActorId,
      page: query.page,
      savedViewId: query.savedViewId,
      size: query.size,
      sortDirection: query.sortDirection,
      sortField: query.sortField,
      starred: query.starred,
      subordinateOwnerOnly: query.subordinateOwnerOnly,
    }),
  businessOverview: (identityKey: string, id: number) =>
    [...entityKeys.all, "business-overview", identityKey, id] as const,
  collaboratorBaseline: (identityKey: string, id: number) =>
    [...entityKeys.all, "collaborator-baseline", identityKey, id] as const,
  hierarchy: (identityKey: string, id: number) =>
    [...entityKeys.all, "hierarchy", identityKey, id] as const,
  temporaryFilteredList: (
    identityKey: string,
    query: components["schemas"]["CustomerQueryRequest"],
  ) => {
    const { conditions = [], ...criteria } = query;
    return [...entityKeys.all, "list", identityKey, criteria, conditions] as const;
  },
  nearby: (identityKey: string, query: readonly [number, number, number, number, number]) =>
    [...entityKeys.all, "nearby", identityKey, ...query] as const,
  nearbyPending: (identityKey: string) =>
    [...entityKeys.all, "nearby", identityKey, "pending"] as const,
};
