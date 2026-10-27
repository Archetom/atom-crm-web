import { CustomerContextCreateGateway } from "~/components/entity-selector/customer-context-create-gateway";

export function ReceivablePlanGlobalBatchCreatePage() {
  return (
    <CustomerContextCreateGateway
      createPath={(customerId) => `/crm/customers/${customerId}/receivable-plans/batch-new`}
      description="先选择关联客户，再从该客户当前可见合同中批量建立回款计划。"
      listPath="/crm/receivable-plans"
      title="批量新建回款计划"
      writeAuthority="receivable-plans:write"
    />
  );
}
