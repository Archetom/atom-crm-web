import { CustomerContextCreateGateway } from "~/components/entity-selector/customer-context-create-gateway";

export function ContractGlobalCreatePage() {
  return (
    <CustomerContextCreateGateway
      createPath={(customerId) => `/crm/customers/${customerId}/contracts/new`}
      description="先选择关联客户，再进入现有合同表单填写名称、编号和可选产品。"
      listPath="/crm/contracts"
      title="新建合同"
      writeAuthority="contracts:write"
    />
  );
}
