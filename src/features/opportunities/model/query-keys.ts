import { createEntityQueryKeys } from "~/api/query-keys/entity";
import type { components } from "~/api/generated/schema";

const entityKeys = createEntityQueryKeys("opportunities");

export const opportunityKeys = {
  ...entityKeys,
  pipelineCatalog: (identityKey: string) =>
    [...entityKeys.all, "pipeline-catalog", identityKey] as const,
  pipelineStagesCatalog: (identityKey: string, pipelineId: number) =>
    [...entityKeys.all, "pipeline-catalog", identityKey, pipelineId, "stages"] as const,
  listRequest: (identityKey: string, query: components["schemas"]["OpportunityQueryRequest"]) =>
    entityKeys.list(identityKey, {
      customerId: query.customerId,
      keyword: query.keyword,
      name: query.name,
      outcome: query.outcome,
      ownerActorId: query.ownerActorId,
      page: query.page,
      savedViewId: query.savedViewId,
      size: query.size,
      sortDirection: query.sortDirection,
      sortField: query.sortField,
      starred: query.starred,
    }),
  temporaryFilteredList: (
    identityKey: string,
    query: components["schemas"]["OpportunityQueryRequest"],
  ) => {
    const { conditions = [], ...criteria } = query;
    return [...entityKeys.all, "list", identityKey, criteria, conditions] as const;
  },
  summary: (identityKey: string, query: components["schemas"]["OpportunityQueryRequest"]) =>
    entityKeys.list(identityKey, {
      conditions: query.conditions,
      customerId: query.customerId,
      keyword: query.keyword,
      name: query.name,
      outcome: query.outcome,
      ownerActorId: query.ownerActorId,
      savedViewId: query.savedViewId,
      starred: query.starred,
      summary: "estimated-amount",
    }),
};

export const opportunityEditableBaselineKey = (identityKey: string, opportunityId: number) =>
  ["opportunities", "editable-baseline", identityKey, opportunityId] as const;

export const opportunityCollaboratorBaselineKey = (identityKey: string, opportunityId: number) =>
  ["opportunities", "collaborators", identityKey, opportunityId] as const;

export const opportunityContactsBaselineKey = (identityKey: string, opportunityId: number) =>
  ["opportunities", "contacts-baseline", identityKey, opportunityId] as const;

export const opportunityProductBaselineKey = (identityKey: string, opportunityId: number) =>
  ["opportunities", "products-baseline", identityKey, opportunityId] as const;
