import { CustomerContextCreateGateway } from "~/components/entity-selector/customer-context-create-gateway";

export function InvoiceGlobalCreatePage() {
  return (
    <CustomerContextCreateGateway
      createPath={(customerId) => `/crm/customers/${customerId}/invoices/new`}
      description="先选择关联客户，再进入现有发票表单从该客户可见合同中选择开票依据。"
      listPath="/crm/invoices"
      title="新建发票"
      writeAuthority="invoices:write"
    />
  );
}
