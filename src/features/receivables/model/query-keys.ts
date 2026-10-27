import { createEntityQueryKeys } from "~/api/query-keys/entity";
import type { components } from "~/api/generated/schema";

const entityKeys = createEntityQueryKeys("receivables");

export const receivableKeys = {
  ...entityKeys,
  summary: (identityKey: string, query: components["schemas"]["ReceivableQueryRequest"]) =>
    entityKeys.list(identityKey, {
      conditions: query.conditions,
      contractId: query.contractId,
      customerId: query.customerId,
      keyword: query.keyword,
      ownerActorId: query.ownerActorId,
      receivablePlanId: query.receivablePlanId,
      savedViewId: query.savedViewId,
      subordinateOwnerOnly: query.subordinateOwnerOnly,
      summary: "received-amount",
    }),
};
