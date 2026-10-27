import type { GlobalRecordListRelationFilter } from "~/components/data-view/global-record-list-relation-filter";

/** Receivable-plan filter for the global receivable list, confirmed through the current caller's plan detail. */
export const receivablePlanRelationFilter: GlobalRecordListRelationFilter = {
  additionalAuthorities: ["customers:read"],
  authority: "receivable-plans:read",
  label: "回款计划",
  parameter: "receivablePlanId",
  loadOptions: (apiClient, keyword) =>
    apiClient.getVisibleReceivablePlans({
      keyword: keyword || undefined,
      page: 1,
      size: 50,
    }),
  resolveOption: (apiClient, planId) => apiClient.getVisibleReceivablePlan(planId),
};
