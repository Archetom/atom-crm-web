import { CustomerContextCreateGateway } from "~/components/entity-selector/customer-context-create-gateway";

export function ReceivablePlanGlobalCreatePage() {
  return (
    <CustomerContextCreateGateway
      createPath={(customerId) => `/crm/customers/${customerId}/receivable-plans/new`}
      description="先选择关联客户，再从该客户当前可见合同中建立回款计划。"
      listPath="/crm/receivable-plans"
      title="新建回款计划"
      writeAuthority="receivable-plans:write"
    />
  );
}
