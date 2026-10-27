import type {
  ApprovalDefinitionObjectType,
  ApprovalDefinitionStatus,
} from "./approval-definition-list-item";

export const approvalDefinitionObjectTypeLabels: Record<ApprovalDefinitionObjectType, string> = {
  CONTACT: "联系人",
  CONTRACT: "合同",
  CUSTOMER: "客户",
  INVOICE: "发票",
  LEAD: "线索",
  OA_REQUEST: "OA 申请",
  OPPORTUNITY: "商机",
  PRODUCT: "产品",
  RECEIVABLE: "回款",
  RECEIVABLE_PLAN: "回款计划",
  RETURN_VISIT: "回访",
};

export const approvalDefinitionStatusLabels: Record<ApprovalDefinitionStatus, string> = {
  ACTIVE: "已启用",
  DELETED: "已删除",
  INACTIVE: "未启用",
};

export const approvalDefinitionStatusColors: Record<
  ApprovalDefinitionStatus,
  "default" | "green" | "orange"
> = {
  ACTIVE: "green",
  DELETED: "default",
  INACTIVE: "orange",
};
