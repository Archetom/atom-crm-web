import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import {
  GlobalRecordList,
  type GlobalRecordListColumnPreference,
  type GlobalRecordListSelection,
  type GlobalRecordListSortConfig,
} from "~/components/data-view/global-record-list";
import {
  dynamicListColumnOptions,
  dynamicListColumns,
} from "~/components/data-view/dynamic-list-columns";
import type { FieldDefinition } from "~/components/dynamic-field";
import { customerContextGlobalCreatePath } from "~/components/entity-selector/customer-context-create-route";
import { contractRelationFilter } from "~/components/entity-selector/contract-relation-filter";

import { InvoiceDetailDrawer } from "../components/invoice-detail-drawer";
import { toInvoiceListItem, type InvoiceListItem } from "../model/invoice-list-item";
import { selectedInvoiceIdFromSearch } from "../model/invoice-list-route";
import {
  defaultInvoiceListSort,
  invoiceCustomSortOptions,
  invoiceListSortFromSearch,
  invoiceListSortLabel,
  invoiceListSortOptions,
  resolveInvoiceListSort,
  withInvoiceListSort,
} from "../model/invoice-list-sort";
import { invoiceKeys } from "../model/query-keys";

function updateSearch(
  current: URLSearchParams,
  update: Record<string, number | string | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}

function columns(onOpen: (invoice: InvoiceListItem) => void): ColumnsType<InvoiceListItem> {
  return [
    {
      dataIndex: "applicationNumber",
      key: "application_number",
      title: "申请编号",
      render: (value: string | null, item) => (
        <Button data-detail-trigger-id={item.id} type="link" onClick={() => onOpen(item)}>
          {value ?? item.invoiceNumber ?? `发票 ${item.id}`}
        </Button>
      ),
    },
    {
      key: "customer",
      title: "客户",
      render: (_value: unknown, item) => `客户 ${item.customerId}`,
    },
    {
      dataIndex: "invoiceNumber",
      key: "invoice_number",
      title: "发票号码",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "invoiceType",
      key: "invoice_type",
      title: "发票类型",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "requestedDate",
      key: "requested_date",
      title: "申请日期",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "issuedDate",
      key: "issued_date",
      title: "开票日期",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "contractId",
      key: "contract",
      title: "合同",
      render: (value: number | null) => (value === null ? "—" : `合同 ${value}`),
    },
    {
      dataIndex: "status",
      key: "status",
      title: "状态",
      render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
    },
  ];
}

const invoiceColumnPreference: GlobalRecordListColumnPreference = {
  objectType: "INVOICE",
  options: [
    { code: "application_number", label: "申请编号" },
    { code: "customer", label: "客户" },
    { code: "invoice_number", label: "发票号码" },
    { code: "invoice_type", label: "发票类型" },
    { code: "requested_date", label: "申请日期" },
    { code: "issued_date", label: "开票日期" },
    { code: "contract", label: "合同" },
    { code: "status", label: "状态" },
  ],
};

const invoiceColumnCodes = [
  "application_number",
  "customer",
  "invoice_number",
  "invoice_type",
  "requested_date",
  "issued_date",
  "contract",
  "status",
] as const;

const invoiceDynamicFields = {
  columnOptions: (fields: readonly FieldDefinition[]) =>
    dynamicListColumnOptions(fields, invoiceColumnCodes),
  columns: (fields: readonly FieldDefinition[]) =>
    dynamicListColumns<InvoiceListItem>(fields, invoiceColumnCodes),
  objectType: "INVOICE",
};

const invoiceSortConfig: GlobalRecordListSortConfig<string> = {
  defaultSort: defaultInvoiceListSort,
  fromSearch: invoiceListSortFromSearch,
  label: (sort, fields) => invoiceListSortLabel(invoiceListSortFromSearch(`sort=${sort}`), fields),
  options: invoiceListSortOptions,
  customOptions: invoiceCustomSortOptions,
  resolve: (sort, fields) =>
    resolveInvoiceListSort(invoiceListSortFromSearch(`sort=${sort}`), fields),
  withSort: (query, sort) => withInvoiceListSort(query, invoiceListSortFromSearch(`sort=${sort}`)),
};

export function InvoiceListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [batchOwnerPickerOpen, setBatchOwnerPickerOpen] = useState(false);
  const [batchOwnerKeyword, setBatchOwnerKeyword] = useState("");
  const [batchOwnerTargets, setBatchOwnerTargets] = useState<readonly InvoiceListItem[]>([]);
  const [batchSelectionResetKey, setBatchSelectionResetKey] = useState(0);
  const identityKey = authState?.identityKey ?? "pending";
  const canAssignInvoices = hasAuthority(authorization, authority.invoicesAssign);
  const canDeleteInvoices = hasAuthority(authorization, authority.invoicesDelete);
  const canResetInvoices = hasAuthority(authorization, authority.invoicesIssue);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canBatchTransfer = canAssignInvoices && canReadOrganization;
  const selectedInvoiceId = selectedInvoiceIdFromSearch(searchParams.toString());
  const openInvoice = (invoice: InvoiceListItem) => {
    setSearchParams(updateSearch(searchParams, { invoiceId: invoice.id }));
  };
  const closeInvoiceDrawer = () => {
    setSearchParams(updateSearch(searchParams, { invoiceId: undefined }));
  };
  const memberQuery = useQuery({
    queryKey: ["member-selector", "invoice-batch-owner", identityKey, batchOwnerKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Invoice owner selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: batchOwnerKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && batchOwnerPickerOpen && canReadOrganization,
  });
  const batchOwnerMutation = useMutation({
    mutationFn: ({
      actorId,
      invoices,
    }: {
      actorId: number;
      invoices: readonly InvoiceListItem[];
    }) =>
      apiClient === null || invoices.length === 0
        ? Promise.reject(new Error("Invoice owner batch update is unavailable."))
        : apiClient.updateInvoiceOwners({
            invoices: invoices.map((invoice) => ({
              invoiceId: invoice.id,
              version: invoice.version,
            })),
            ownerActorId: actorId,
          }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists(identityKey) });
      setBatchOwnerPickerOpen(false);
      setBatchOwnerKeyword("");
      setBatchOwnerTargets([]);
      setBatchSelectionResetKey((current) => current + 1);
      message.success(`已转移 ${variables.invoices.length} 张发票。`);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "发票负责人暂时无法批量更新");
    },
  });
  const batchResetMutation = useMutation({
    mutationFn: (invoices: readonly InvoiceListItem[]) =>
      apiClient === null || invoices.length === 0
        ? Promise.reject(new Error("Invoice batch reset is unavailable."))
        : apiClient.resetInvoices({
            invoices: invoices.map((invoice) => ({
              invoiceId: invoice.id,
              version: invoice.version,
            })),
          }),
    onSuccess: (_result, invoices) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists(identityKey) });
      setBatchSelectionResetKey((current) => current + 1);
      message.success(`已重置 ${invoices.length} 张发票的开票信息。`);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "发票开票信息暂时无法批量重置");
    },
  });
  const batchDeleteMutation = useMutation({
    mutationFn: (invoices: readonly InvoiceListItem[]) =>
      apiClient === null || invoices.length === 0
        ? Promise.reject(new Error("Invoice batch deletion is unavailable."))
        : apiClient.deleteInvoices({
            invoices: invoices.map((invoice) => ({
              invoiceId: invoice.id,
              version: invoice.version,
            })),
          }),
    onSuccess: (_result, invoices) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists(identityKey) });
      setBatchSelectionResetKey((current) => current + 1);
      message.success(`已删除 ${invoices.length} 张发票。`);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "发票暂时无法批量删除");
    },
  });
  const openBatchOwnerPicker = (invoices: readonly InvoiceListItem[]) => {
    setBatchOwnerTargets(invoices);
    setBatchOwnerPickerOpen(true);
  };
  const closeBatchOwnerPicker = () => {
    if (batchOwnerMutation.isPending) return;
    setBatchOwnerPickerOpen(false);
    setBatchOwnerKeyword("");
    setBatchOwnerTargets([]);
  };
  const batchSelection: GlobalRecordListSelection<InvoiceListItem> | undefined =
    canBatchTransfer || canDeleteInvoices || canResetInvoices
      ? {
          renderActions: (invoices) => {
            const canResetSelection = invoices.every((invoice) => invoice.status === "ISSUED");
            const canDeleteSelection = invoices.every((invoice) => invoice.status === "PENDING");
            return (
              <Space wrap>
                {canBatchTransfer ? (
                  <Button
                    disabled={batchOwnerMutation.isPending}
                    onClick={() => openBatchOwnerPicker(invoices)}
                  >
                    转移
                  </Button>
                ) : null}
                {canResetInvoices ? (
                  <Popconfirm
                    cancelText="取消"
                    disabled={!canResetSelection}
                    description="仅已开票的发票可以重置开票信息；服务端会先校验全部版本和字段权限，任一失败均不会重置。"
                    okButtonProps={{ loading: batchResetMutation.isPending }}
                    okText="确认重置"
                    title={`确认重置选中的 ${invoices.length} 张发票的开票信息？`}
                    onConfirm={() => batchResetMutation.mutate(invoices)}
                  >
                    <Button
                      disabled={!canResetSelection || batchResetMutation.isPending}
                      loading={batchResetMutation.isPending}
                      title={canResetSelection ? undefined : "仅可批量重置已开票的发票"}
                    >
                      重置开票信息
                    </Button>
                  </Popconfirm>
                ) : null}
                {canDeleteInvoices ? (
                  <Popconfirm
                    cancelText="取消"
                    disabled={!canDeleteSelection}
                    description="仅待开票的发票可以删除；服务端会先校验全部版本和可见范围，任一失败均不会删除。"
                    okButtonProps={{ danger: true, loading: batchDeleteMutation.isPending }}
                    okText="确认删除"
                    title={`确认删除选中的 ${invoices.length} 张发票？`}
                    onConfirm={() => batchDeleteMutation.mutate(invoices)}
                  >
                    <Button
                      danger
                      disabled={!canDeleteSelection || batchDeleteMutation.isPending}
                      loading={batchDeleteMutation.isPending}
                      title={canDeleteSelection ? undefined : "仅可批量删除待开票的发票"}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            );
          },
          resetKey: batchSelectionResetKey,
        }
      : undefined;

  return (
    <>
      <GlobalRecordList
        authority="invoices:read"
        advancedFilter={{ entityLabel: "发票", objectType: "INVOICE" }}
        columnPreference={invoiceColumnPreference}
        columns={columns(openInvoice)}
        contractFilter={contractRelationFilter}
        customerFilter={{}}
        dynamicFields={invoiceDynamicFields}
        errorMessage="发票列表暂时无法加载"
        label="发票数据工作区"
        load={(apiClient, query) => apiClient.getInvoices(query)}
        primaryAction={{
          additionalAuthorities: ["customers:read"],
          authority: "invoices:write",
          key: "create-invoice",
          label: "新建发票",
          onClick: () =>
            navigate(customerContextGlobalCreatePath("/crm/invoices", location.search)),
        }}
        queryKey={(identityKey, query) => invoiceKeys.list(identityKey, query)}
        renderMobileItem={(item) => (
          <Card
            size="small"
            title={item.applicationNumber ?? item.invoiceNumber ?? `发票 ${item.id}`}
          >
            <Space orientation="vertical" size="small" style={{ display: "flex" }}>
              <Button
                data-detail-trigger-id={item.id}
                type="link"
                onClick={() => openInvoice(item)}
              >
                {item.applicationNumber ?? item.invoiceNumber ?? `发票 ${item.id}`}
              </Button>
              <Typography.Text>{`客户 ${item.customerId}`}</Typography.Text>
              <Typography.Text>{`申请日期：${item.requestedDate ?? "未提供"}`}</Typography.Text>
              <Typography.Text>{`开票日期：${item.issuedDate ?? "未提供"}`}</Typography.Text>
              <Typography.Text>
                {item.contractId === null ? "未提供合同引用" : `合同 ${item.contractId}`}
              </Typography.Text>
              {item.status === null ? null : <Tag>{item.status}</Tag>}
            </Space>
          </Card>
        )}
        searchLabel="搜索发票"
        searchPlaceholder="搜索申请编号、发票号码或关键词"
        selection={batchSelection}
        sortConfig={invoiceSortConfig}
        supportsMine
        supportsSubordinates
        statusOptions={[
          { label: "待开票", value: "PENDING" },
          { label: "已开票", value: "ISSUED" },
        ]}
        title="发票管理"
        toItem={toInvoiceListItem}
      />
      <Modal
        destroyOnHidden
        footer={null}
        open={batchOwnerPickerOpen}
        title="批量转移负责人"
        onCancel={closeBatchOwnerPicker}
      >
        <Typography.Paragraph type="secondary">
          {`将为 ${batchOwnerTargets.length} 张已选发票设置同一负责人。仅显示服务端允许当前成员查看的在职成员，最终可分配范围、字段权限和并发仍由服务端校验。`}
        </Typography.Paragraph>
        <Input.Search
          allowClear
          defaultValue={batchOwnerKeyword}
          placeholder="按成员姓名搜索"
          onSearch={(keyword) => setBatchOwnerKeyword(keyword)}
        />
        {memberQuery.isError ? (
          <Alert title="成员列表暂时无法加载" showIcon style={{ marginTop: 12 }} type="error" />
        ) : (
          <List
            dataSource={[...(memberQuery.data ?? [])]}
            loading={memberQuery.isLoading}
            locale={{ emptyText: "未找到可选择成员" }}
            renderItem={(member) => (
              <List.Item
                actions={[
                  <Button
                    disabled={batchOwnerMutation.isPending || batchOwnerTargets.length === 0}
                    key={member.actorId}
                    loading={batchOwnerMutation.isPending}
                    type="link"
                    onClick={() =>
                      batchOwnerMutation.mutate({
                        actorId: member.actorId,
                        invoices: batchOwnerTargets,
                      })
                    }
                  >
                    转移
                  </Button>,
                ]}
              >
                <List.Item.Meta description={`成员 ${member.actorId}`} title={member.displayName} />
              </List.Item>
            )}
          />
        )}
      </Modal>
      <InvoiceDetailDrawer
        invoiceId={selectedInvoiceId}
        open={selectedInvoiceId !== null}
        onClose={closeInvoiceDrawer}
      />
    </>
  );
}
