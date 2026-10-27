import { createEntityQueryKeys } from "~/api/query-keys/entity";
import type { components } from "~/api/generated/schema";

const entityKeys = createEntityQueryKeys("contacts");

export const contactKeys = {
  ...entityKeys,
  listRequest: (identityKey: string, query: components["schemas"]["ContactQueryRequest"]) =>
    entityKeys.list(identityKey, {
      customerId: query.customerId,
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
  collaboratorBaseline: (identityKey: string, id: number) =>
    [...entityKeys.all, "collaborator-baseline", identityKey, id] as const,
  hierarchy: (identityKey: string, id: number) =>
    [...entityKeys.all, "hierarchy", identityKey, id] as const,
  nearby: (identityKey: string, query: readonly [number, number, number, number, number]) =>
    [...entityKeys.all, "nearby", identityKey, ...query] as const,
  nearbyPending: (identityKey: string) =>
    [...entityKeys.all, "nearby", identityKey, "pending"] as const,
  temporaryFilteredList: (
    identityKey: string,
    query: components["schemas"]["ContactQueryRequest"],
  ) => {
    const { conditions = [], ...criteria } = query;
    return [...entityKeys.all, "list", identityKey, criteria, conditions] as const;
  },
};
