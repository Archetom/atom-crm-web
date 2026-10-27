import { CustomerContextCreateGateway } from "~/components/entity-selector/customer-context-create-gateway";

export function ReceivableGlobalCreatePage() {
  return (
    <CustomerContextCreateGateway
      createPath={(customerId) => `/crm/customers/${customerId}/receivables/new`}
      description="先选择关联客户，再进入现有回款表单从该客户可见合同和可选回款计划中选择依据。"
      listPath="/crm/receivables"
      title="新建回款"
      writeAuthority="receivables:write"
    />
  );
}
