export const zhCNMessages = {
  "navigation.workspace": "工作空间",
  "navigation.home": "工作台",
  "navigation.crm": "客户管理",
  "navigation.customers": "客户",
  "navigation.customerPools": "客户公海",
  "navigation.leads": "线索",
  "navigation.contacts": "联系人",
  "navigation.contactPools": "联系人公海",
  "navigation.opportunities": "商机",
  "navigation.products": "产品",
  "navigation.contracts": "合同",
  "navigation.receivables": "回款",
  "navigation.invoices": "发票",
  "navigation.returnVisits": "回访",
  "navigation.marketingActivities": "市场活动",
  "navigation.marketing": "营销",
  "navigation.marketingForms": "营销表单",
  "navigation.oa": "办公协同",
  "navigation.oaForms": "OA 表单",
  "navigation.oaRequests": "OA 申请",
  "navigation.oaAnnouncements": "内部公告",
  "navigation.reports": "报表",
  "navigation.workflowDefinitions": "阶段工作流",
  "navigation.organization": "组织",
  "navigation.tenants": "租户",
  "navigation.departments": "部门",
  "navigation.members": "成员",
  "navigation.administration": "管理",
  "navigation.users": "用户",
  "navigation.roles": "角色与权限",
  "navigation.fields": "字段管理",
  "navigation.performanceTargets": "业绩目标",
  "navigation.embeddedPages": "嵌入页面",
} as const;

export type MessageKey = keyof typeof zhCNMessages;

export function translateTitleKey(titleKey: string, fallback = "未命名菜单"): string {
  return titleKey in zhCNMessages ? zhCNMessages[titleKey as MessageKey] : fallback;
}
