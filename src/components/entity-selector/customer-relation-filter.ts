import type { components } from "~/api/generated/schema";
import type { GlobalRecordListRelationFilter } from "~/components/data-view/global-record-list-relation-filter";

export function customerRelationOptionsQuery(
  keyword: string,
): Pick<components["schemas"]["CustomerQueryRequest"], "keyword" | "page" | "size"> {
  return {
    keyword: keyword || undefined,
    page: 1,
    size: 50,
  };
}

/**
 * Customer filter shared by lists whose query contracts accept `customerId`.
 * Candidates and recovered URL values are both confirmed through the caller scoped
 * customer directory before a record query is sent.
 */
export const customerRelationFilter: GlobalRecordListRelationFilter = {
  authority: "customers:read",
  label: "客户",
  parameter: "customerId",
  loadOptions: (apiClient, keyword) =>
    apiClient.getVisibleCustomers(customerRelationOptionsQuery(keyword)),
  resolveOption: (apiClient, customerId) => apiClient.getCustomer(customerId),
};
