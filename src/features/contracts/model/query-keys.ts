import { createEntityQueryKeys } from "~/api/query-keys/entity";
import type { components } from "~/api/generated/schema";

const entityKeys = createEntityQueryKeys("contracts");

export const contractKeys = {
  ...entityKeys,
  summary: (identityKey: string, query: components["schemas"]["ContractQueryRequest"]) =>
    entityKeys.list(identityKey, {
      conditions: query.conditions,
      customerId: query.customerId,
      keyword: query.keyword,
      opportunityId: query.opportunityId,
      ownerActorId: query.ownerActorId,
      savedViewId: query.savedViewId,
      status: query.status,
      subordinateOwnerOnly: query.subordinateOwnerOnly,
      summary: "financial-amounts",
    }),
  collaborators: (identityKey: string, id: number) =>
    [...entityKeys.all, "collaborators", identityKey, id] as const,
  products: (identityKey: string, id: number) =>
    [...entityKeys.all, "products", identityKey, id] as const,
};
