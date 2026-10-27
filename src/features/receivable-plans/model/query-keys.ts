import { createEntityQueryKeys } from "~/api/query-keys/entity";
import type { components } from "~/api/generated/schema";

const entityKeys = createEntityQueryKeys("receivable-plans");

export const receivablePlanKeys = {
  ...entityKeys,
  summary: (identityKey: string, query: components["schemas"]["ReceivablePlanQueryRequest"]) =>
    entityKeys.list(identityKey, {
      contractId: query.contractId,
      conditions: query.conditions,
      customerId: query.customerId,
      keyword: query.keyword,
      ownerActorId: query.ownerActorId,
      savedViewId: query.savedViewId,
      subordinateOwnerOnly: query.subordinateOwnerOnly,
      summary: "plan-amounts",
    }),
};
