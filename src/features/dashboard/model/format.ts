export { formatServerAmount } from "~/shared/utils/format-server-amount";

export function formatMetric(metric: string): string {
  const labels: Record<string, string> = {
    WON_OPPORTUNITY: "赢单商机",
    ACTIVE_CONTRACT: "有效合同",
    ACTIVE_RECEIVABLE: "活跃回款",
    OPEN_OPPORTUNITY_ESTIMATED_AMOUNT: "进行中商机预计金额",
    WON_OPPORTUNITY_ESTIMATED_AMOUNT: "赢单商机预计金额",
    LOST_OPPORTUNITY_ESTIMATED_AMOUNT: "输单商机预计金额",
    ACTIVE_CONTRACT_AMOUNT: "有效合同金额",
    RECEIVABLE_AMOUNT: "待回款金额",
  };

  return labels[metric] ?? metric;
}

/** Labels the fixed, permission-aware sales brief metrics returned by the overview API. */
export function formatSalesBriefMetric(metric: string): string {
  const labels: Record<string, string> = {
    NEW_CUSTOMER: "新增客户",
    NEW_CONTACT: "新增联系人",
    NEW_OPPORTUNITY: "新增商机",
    NEW_CONTRACT: "新增合同",
    CONTRACT_AMOUNT: "新增合同金额",
    OPPORTUNITY_AMOUNT: "新增商机金额",
    RECEIVABLE_AMOUNT: "回款金额",
    NEW_LEAD: "新增线索",
    NEW_FOLLOW_UP: "新增跟进",
  };

  return labels[metric] ?? metric;
}
