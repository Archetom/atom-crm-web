import type { GlobalRecordListRelationFilter } from "~/components/data-view/global-record-list-relation-filter";

/** Opportunity filter for the global contract list, confirmed through the current callers opportunity detail. */
export const opportunityRelationFilter: GlobalRecordListRelationFilter = {
  authority: "opportunities:read",
  label: "商机",
  parameter: "opportunityId",
  loadOptions: (apiClient, keyword) =>
    apiClient.getVisibleOpportunities({
      keyword: keyword || undefined,
      page: 1,
      size: 50,
    }),
  resolveOption: (apiClient, opportunityId) => apiClient.getVisibleOpportunity(opportunityId),
};
