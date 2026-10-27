import type { GlobalRecordListRelationFilter } from "~/components/data-view/global-record-list-relation-filter";

/** Contract relation filter shared by the invoice, receivable, and return-visit global lists. */
export const contractRelationFilter: GlobalRecordListRelationFilter = {
  additionalAuthorities: ["customers:read"],
  authority: "contracts:read",
  label: "合同",
  parameter: "contractId",
  loadOptions: (apiClient, keyword) =>
    apiClient.getVisibleContracts({
      keyword: keyword || undefined,
      page: 1,
      size: 50,
    }),
  resolveOption: (apiClient, contractId) => apiClient.getVisibleContract(contractId),
};
