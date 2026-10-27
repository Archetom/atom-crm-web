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

import type { components } from "~/api/generated/schema";
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
import { receivablePlanRelationFilter } from "~/components/entity-selector/receivable-plan-relation-filter";
import { ApprovalStatusTag } from "~/features/approvals";

import { ReceivableDetailDrawer } from "../components/receivable-detail-drawer";
import { receivableKeys } from "../model/query-keys";
import { toReceivableListItem, type ReceivableListItem } from "../model/receivable-list-item";
import { selectedReceivableIdFromSearch } from "../model/receivable-list-route";
import {
  defaultReceivableListSort,
  receivableCustomSortOptions,
  receivableListSortFromSearch,
  receivableListSortLabel,
  receivableListSortOptions,
  resolveReceivableListSort,
  withReceivableListSort,
} from "../model/receivable-list-sort";

function reference(label: string, value: number | null): string {
  return value === null ? "—" : `${label} ${value}`;
}

function amount(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat("zh-CN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }).format(value);
}

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

function columns(
  onOpen: (receivable: ReceivableListItem) => void,
): ColumnsType<ReceivableListItem> {
  return [
    {
      dataIndex: "receiptNumber",
      key: "receipt_number",
      title: "回款编号",
      render: (value: string | null, item) => (
        <Button data-detail-trigger-id={item.id} type="link" onClick={() => onOpen(item)}>
          {value ?? `回款 ${item.id}`}
        </Button>
      ),
    },
    {
      key: "customer",
      title: "客户",
      render: (_value: unknown, item) => `客户 ${item.customerId}`,
    },
    {
      dataIndex: "receivedDate",
      key: "received_date",
      title: "回款日期",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "contractId",
      key: "contract",
      title: "合同",
      render: (value: number | null) => reference("合同", value),
    },
    {
      dataIndex: "receivablePlanId",
      key: "receivable_plan",
      title: "回款计划",
      render: (value: number | null) => reference("计划", value),
    },
    {
      dataIndex: "amount",
      key: "amount",
      title: "回款金额",
      render: (value: number | null) => amount(value),
    },
    {
      dataIndex: "paymentMethod",
      key: "payment_method",
      title: "回款方式",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "remark",
      key: "remark",
      title: "备注",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "status",
      key: "status",
      title: "记录状态",
      render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
    },
    {
      dataIndex: "approvalStatus",
      key: "approval_status",
      title: "审批状态",
      render: (value) => <ApprovalStatusTag status={value} />,
    },
    {
      dataIndex: "ownerActorId",
      key: "owner_actor",
      title: "负责人",
      render: (value: number | null) => reference("成员", value),
    },
    {
      dataIndex: "updatedTime",
      key: "updated_time",
      title: "更新时间",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "createdTime",
      key: "created_time",
      title: "创建时间",
      render: (value: string | null) => value ?? "—",
    },
  ];
}

const receivableColumnCodes = [
  "receipt_number",
  "customer",
  "received_date",
  "contract",
  "receivable_plan",
  "amount",
  "payment_method",
  "remark",
  "status",
  "approval_status",
  "owner_actor",
  "updated_time",
  "created_time",
] as const;

const receivableColumnPreference: GlobalRecordListColumnPreference = {
  objectType: "RECEIVABLE",
  options: [
    { code: "receipt_number", label: "回款编号" },
    { code: "customer", label: "客户" },
    { code: "received_date", label: "回款日期" },
    { code: "contract", label: "合同" },
    { code: "receivable_plan", label: "回款计划" },
    { code: "amount", label: "回款金额" },
    { code: "payment_method", label: "回款方式" },
    { code: "remark", label: "备注" },
    { code: "status", label: "记录状态" },
    { code: "approval_status", label: "审批状态" },
    { code: "owner_actor", label: "负责人" },
    { code: "updated_time", label: "更新时间" },
    { code: "created_time", label: "创建时间" },
  ],
};

const receivableDynamicFields = {
  columnOptions: (fields: readonly FieldDefinition[]) =>
    dynamicListColumnOptions(fields, receivableColumnCodes),
  columns: (fields: readonly FieldDefinition[]) =>
    dynamicListColumns<ReceivableListItem>(fields, receivableColumnCodes),
  objectType: "RECEIVABLE",
};

const receivableSortConfig: GlobalRecordListSortConfig<string> = {
  defaultSort: defaultReceivableListSort,
  fromSearch: receivableListSortFromSearch,
  label: (sort, fields) =>
    receivableListSortLabel(receivableListSortFromSearch(`sort=${sort}`), fields),
  options: receivableListSortOptions,
  customOptions: receivableCustomSortOptions,
  resolve: (sort, fields) =>
    resolveReceivableListSort(receivableListSortFromSearch(`sort=${sort}`), fields),
  withSort: (query, sort) =>
    withReceivableListSort(query, receivableListSortFromSearch(`sort=${sort}`)),
};

export function ReceivableListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [batchOwnerPickerOpen, setBatchOwnerPickerOpen] = useState(false);
  const [batchOwnerKeyword, setBatchOwnerKeyword] = useState("");
  const [batchOwnerTargets, setBatchOwnerTargets] = useState<readonly ReceivableListItem[]>([]);
  const [batchSelectionResetKey, setBatchSelectionResetKey] = useState(0);
  const identityKey = authState?.identityKey ?? "pending";
  const canAssignReceivables = hasAuthority(authorization, authority.receivablesAssign);
  const canDeleteReceivables = hasAuthority(authorization, authority.receivablesDelete);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canBatchTransfer = canAssignReceivables && canReadOrganization;
  const selectedReceivableId = selectedReceivableIdFromSearch(searchParams.toString());
  const openReceivable = (receivable: ReceivableListItem) => {
    setSearchParams(updateSearch(searchParams, { receivableId: receivable.id }));
  };
  const closeReceivableDrawer = () => {
    setSearchParams(updateSearch(searchParams, { receivableId: undefined }));
  };
  const memberQuery = useQuery({
    queryKey: [
      "member-selector",
      "receivable-batch-owner",
      identityKey,
      batchOwnerKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Receivable owner selection is unavailable."))
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
      receivables,
    }: {
      actorId: number;
      receivables: readonly ReceivableListItem[];
    }) =>
      apiClient === null || receivables.length === 0
        ? Promise.reject(new Error("Receivable owner batch update is unavailable."))
        : apiClient.updateReceivableOwners({
            ownerActorId: actorId,
            receivables: receivables.map((receivable) => ({
              receivableId: receivable.id,
              version: receivable.version,
            })),
          }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: receivableKeys.lists(identityKey) });
      setBatchOwnerPickerOpen(false);
      setBatchOwnerKeyword("");
      setBatchOwnerTargets([]);
      setBatchSelectionResetKey((current) => current + 1);
      message.success(`已转移 ${variables.receivables.length} 条回款。`);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "回款负责人暂时无法批量更新");
    },
  });
  const batchDeleteMutation = useMutation({
    mutationFn: (receivables: readonly ReceivableListItem[]) =>
      apiClient === null || receivables.length === 0
        ? Promise.reject(new Error("Receivable batch deletion is unavailable."))
        : apiClient.deleteReceivables({
            receivables: receivables.map((receivable) => ({
              receivableId: receivable.id,
              version: receivable.version,
            })),
          }),
    onSuccess: (_result, receivables) => {
      void queryClient.invalidateQueries({ queryKey: receivableKeys.lists(identityKey) });
      setBatchSelectionResetKey((current) => current + 1);
      message.success(`已删除 ${receivables.length} 条回款。`);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "回款暂时无法批量删除");
    },
  });
  const openBatchOwnerPicker = (receivables: readonly ReceivableListItem[]) => {
    setBatchOwnerTargets(receivables);
    setBatchOwnerPickerOpen(true);
  };
  const closeBatchOwnerPicker = () => {
    if (batchOwnerMutation.isPending) return;
    setBatchOwnerPickerOpen(false);
    setBatchOwnerKeyword("");
    setBatchOwnerTargets([]);
  };
  const batchSelection: GlobalRecordListSelection<ReceivableListItem> | undefined =
    canBatchTransfer || canDeleteReceivables
      ? {
          renderActions: (receivables) => (
            <Space wrap>
              {canBatchTransfer ? (
                <Button
                  disabled={batchOwnerMutation.isPending}
                  onClick={() => openBatchOwnerPicker(receivables)}
                >
                  转移
                </Button>
              ) : null}
              {canDeleteReceivables ? (
                <Popconfirm
                  cancelText="取消"
                  description="服务端会先校验全部回款的版本和可见范围；任一项失败时不会删除其中任何回款。"
                  okButtonProps={{ danger: true, loading: batchDeleteMutation.isPending }}
                  okText="确认删除"
                  title={`确认删除选中的 ${receivables.length} 条回款？`}
                  onConfirm={() => batchDeleteMutation.mutate(receivables)}
                >
                  <Button
                    danger
                    disabled={batchDeleteMutation.isPending}
                    loading={batchDeleteMutation.isPending}
                  >
                    删除
                  </Button>
                </Popconfirm>
              ) : null}
            </Space>
          ),
          resetKey: batchSelectionResetKey,
        }
      : undefined;

  return (
    <>
      <GlobalRecordList<ReceivableListItem, components["schemas"]["ReceivableListSummaryResponse"]>
        authority="receivables:read"
        advancedFilter={{ entityLabel: "回款", objectType: "RECEIVABLE" }}
        columnPreference={receivableColumnPreference}
        columns={columns(openReceivable)}
        contractFilter={contractRelationFilter}
        customerFilter={{}}
        dynamicFields={receivableDynamicFields}
        errorMessage="回款列表暂时无法加载"
        label="回款数据工作区"
        load={(apiClient, query) => apiClient.getReceivables(query)}
        primaryAction={{
          additionalAuthorities: ["customers:read"],
          authority: "receivables:write",
          key: "create-receivable",
          label: "新建回款",
          onClick: () =>
            navigate(customerContextGlobalCreatePath("/crm/receivables", location.search)),
        }}
        queryKey={(identityKey, query) => receivableKeys.list(identityKey, query)}
        receivablePlanFilter={receivablePlanRelationFilter}
        renderMobileItem={(item) => (
          <Card size="small" title={item.receiptNumber ?? `回款 ${item.id}`}>
            <Space orientation="vertical" size="small" style={{ display: "flex" }}>
              <Button
                data-detail-trigger-id={item.id}
                type="link"
                onClick={() => openReceivable(item)}
              >
                {item.receiptNumber ?? `回款 ${item.id}`}
              </Button>
              <Typography.Text>{`客户 ${item.customerId}`}</Typography.Text>
              <Typography.Text>{`回款日期：${item.receivedDate ?? "未提供"}`}</Typography.Text>
              <Typography.Text>{reference("合同", item.contractId)}</Typography.Text>
              <Typography.Text>{reference("回款计划", item.receivablePlanId)}</Typography.Text>
              <Typography.Text>{`回款金额：${amount(item.amount)}`}</Typography.Text>
              <Typography.Text>{`回款方式：${item.paymentMethod ?? "—"}`}</Typography.Text>
              <Typography.Text>{`备注：${item.remark ?? "—"}`}</Typography.Text>
              <Typography.Text>{reference("负责人", item.ownerActorId)}</Typography.Text>
              <Typography.Text>
                记录状态：{item.status === null ? "—" : <Tag>{item.status}</Tag>}
              </Typography.Text>
              <Typography.Text>
                审批状态：
                <ApprovalStatusTag status={item.approvalStatus} />
              </Typography.Text>
            </Space>
          </Card>
        )}
        searchLabel="搜索回款"
        searchPlaceholder="搜索回款编号或关键词"
        selection={batchSelection}
        sortConfig={receivableSortConfig}
        secondaryActions={[
          {
            authority: "receivable-plans:read",
            key: "view-receivable-plans",
            label: "回款计划",
            onClick: () => navigate("/crm/receivable-plans"),
          },
        ]}
        summary={{
          load: (apiClient, query) => apiClient.getReceivableSummary(query),
          queryKey: (identityKey, query) => receivableKeys.summary(identityKey, query),
          render: (summary) => (
            <Typography.Text
              aria-label="回款金额汇总"
              strong
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {`回款金额：${amount(summary.totalAmount)}`}
            </Typography.Text>
          ),
        }}
        supportsMine
        supportsSubordinates
        title="回款管理"
        toItem={toReceivableListItem}
      />
      <Modal
        destroyOnHidden
        footer={null}
        open={batchOwnerPickerOpen}
        title="批量转移负责人"
        onCancel={closeBatchOwnerPicker}
      >
        <Typography.Paragraph type="secondary">
          {`将为 ${batchOwnerTargets.length} 条已选回款设置同一负责人。仅显示服务端允许当前成员查看的在职成员，最终可分配范围、字段权限和并发仍由服务端校验。`}
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
                        receivables: batchOwnerTargets,
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
      <ReceivableDetailDrawer
        open={selectedReceivableId !== null}
        receivableId={selectedReceivableId}
        onClose={closeReceivableDrawer}
      />
    </>
  );
}
