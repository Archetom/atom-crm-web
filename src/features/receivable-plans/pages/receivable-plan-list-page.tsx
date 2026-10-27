import { useMutation } from "@tanstack/react-query";
import { Button, Card, Space, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useLocation, useNavigate } from "react-router";

import { saveControlledDownload } from "~/api/client/controlled-download";
import type { components } from "~/api/generated/schema";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import {
  GlobalRecordList,
  type GlobalRecordListColumnPreference,
} from "~/components/data-view/global-record-list";
import type { GlobalRecordListQuery } from "~/components/data-view/global-record-list-scene";
import {
  dynamicListColumnOptions,
  dynamicListColumns,
} from "~/components/data-view/dynamic-list-columns";
import type { FieldDefinition } from "~/components/dynamic-field";
import {
  customerContextGlobalBatchCreatePath,
  customerContextGlobalCreatePath,
  customerContextGlobalDetailPath,
  customerContextPlanReceivableCreatePath,
} from "~/components/entity-selector/customer-context-create-route";
import { contractRelationFilter } from "~/components/entity-selector/contract-relation-filter";

import { receivablePlanKeys } from "../model/query-keys";
import {
  toReceivablePlanListItem,
  type ReceivablePlanListItem,
} from "../model/receivable-plan-list-item";

function amount(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat("zh-CN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }).format(value);
}

function reference(label: string, value: number | null): string {
  return value === null ? "—" : `${label} ${value}`;
}

function installmentLabel(value: number | null, id: number): string {
  return value === null ? `回款计划 ${id}` : `第 ${value} 期`;
}

function columns(
  canCreateReceivable: boolean,
  onOpen: (plan: ReceivablePlanListItem) => void,
  onCreateReceivable: (plan: ReceivablePlanListItem) => void,
): ColumnsType<ReceivablePlanListItem> {
  return [
    {
      key: "customer",
      title: "客户",
      render: (_value: unknown, item) => reference("客户", item.customerId),
    },
    {
      dataIndex: "installment",
      key: "installment",
      title: "期数",
      render: (value: number | null, item) =>
        item.customerId === null ? (
          installmentLabel(value, item.id)
        ) : (
          <Button data-detail-trigger-id={item.id} type="link" onClick={() => onOpen(item)}>
            {installmentLabel(value, item.id)}
          </Button>
        ),
    },
    {
      dataIndex: "contractId",
      key: "contract",
      title: "合同",
      render: (value: number | null) => reference("合同", value),
    },
    {
      dataIndex: "dueDate",
      key: "due_date",
      title: "到期日期",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "plannedAmount",
      key: "planned_amount",
      title: "计划回款金额",
      render: (value: number | null) => amount(value),
    },
    {
      dataIndex: "receivedAmount",
      key: "received_amount",
      title: "实际回款金额",
      render: (value: number | null) => amount(value),
    },
    {
      dataIndex: "remainingAmount",
      key: "remaining_amount",
      title: "未回款金额",
      render: (value: number | null) => amount(value),
    },
    {
      dataIndex: "paymentMethod",
      key: "payment_method",
      title: "回款方式",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "progress",
      key: "progress",
      title: "进度",
      render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
    },
    {
      dataIndex: "status",
      key: "status",
      title: "记录状态",
      render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
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
      key: "actions",
      title: "操作",
      render: (_value: unknown, plan) =>
        canCreateReceivable && plan.customerId !== null && plan.contractId !== null ? (
          <Button type="link" onClick={() => onCreateReceivable(plan)}>
            新建回款
          </Button>
        ) : (
          "—"
        ),
    },
  ];
}

const receivablePlanColumnCodes = [
  "customer",
  "installment",
  "contract",
  "due_date",
  "planned_amount",
  "received_amount",
  "remaining_amount",
  "payment_method",
  "progress",
  "status",
  "owner_actor",
  "updated_time",
] as const;

const receivablePlanColumnPreference: GlobalRecordListColumnPreference = {
  objectType: "RECEIVABLE_PLAN",
  options: [
    { code: "customer", label: "客户" },
    { code: "installment", label: "期数" },
    { code: "contract", label: "合同" },
    { code: "due_date", label: "到期日期" },
    { code: "planned_amount", label: "计划回款金额" },
    { code: "received_amount", label: "实际回款金额" },
    { code: "remaining_amount", label: "未回款金额" },
    { code: "payment_method", label: "回款方式" },
    { code: "progress", label: "进度" },
    { code: "status", label: "记录状态" },
    { code: "owner_actor", label: "负责人" },
    { code: "updated_time", label: "更新时间" },
  ],
};

const receivablePlanDynamicFields = {
  columnOptions: (fields: readonly FieldDefinition[]) =>
    dynamicListColumnOptions(fields, receivablePlanColumnCodes),
  columns: (fields: readonly FieldDefinition[]) =>
    dynamicListColumns<ReceivablePlanListItem>(fields, receivablePlanColumnCodes),
  objectType: "RECEIVABLE_PLAN",
};

const receivablePlanExportFieldCodes = [
  "customer",
  "plan_number",
  "contract",
  "due_date",
  "planned_amount",
  "received_amount",
  "remaining_amount",
  "payment_method",
  "progress",
  "status",
  "owner_actor",
  "updated_time",
] as const;

function toReceivablePlanCsvExportRequest(
  query: GlobalRecordListQuery,
): components["schemas"]["ReceivablePlanCsvExportRequest"] {
  return {
    conditions: query.conditions,
    contractId: query.contractId,
    customerId: query.customerId,
    fieldCodes: [...receivablePlanExportFieldCodes],
    keyword: query.keyword,
    ownerActorId: query.ownerActorId,
    savedViewId: query.savedViewId,
    subordinateOwnerOnly: query.subordinateOwnerOnly,
  };
}

export function ReceivablePlanListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { apiClient, authorization } = useBootstrap();
  const canCreateReceivable =
    hasAuthority(authorization, authority.receivablesWrite) &&
    hasAuthority(authorization, authority.contractsRead) &&
    hasAuthority(authorization, authority.customersRead) &&
    hasAuthority(authorization, authority.receivablePlansRead);
  const openPlan = (plan: ReceivablePlanListItem) => {
    if (plan.customerId !== null) {
      navigate(
        customerContextGlobalDetailPath(
          `/crm/customers/${plan.customerId}/receivable-plans/${plan.id}`,
          location.search,
        ),
      );
    }
  };
  const createReceivable = (plan: ReceivablePlanListItem) => {
    if (plan.customerId === null || plan.contractId === null) return;
    navigate(customerContextPlanReceivableCreatePath(plan.customerId, plan.id, location.search));
  };
  const exportMutation = useMutation({
    mutationFn: (query: GlobalRecordListQuery) =>
      apiClient === null
        ? Promise.reject(new Error("回款计划 CSV 导出暂时不可用。"))
        : apiClient.exportReceivablePlansCsv(toReceivablePlanCsvExportRequest(query)),
    onError: () => message.error("无法导出回款计划 CSV，请稍后重试。"),
    onSuccess: (download) => {
      saveControlledDownload(download);
      message.success("回款计划 CSV 已开始下载。");
    },
  });

  return (
    <GlobalRecordList<
      ReceivablePlanListItem,
      components["schemas"]["ReceivablePlanListSummaryResponse"]
    >
      authority="receivable-plans:read"
      advancedFilter={{ entityLabel: "回款计划", objectType: "RECEIVABLE_PLAN" }}
      columnPreference={receivablePlanColumnPreference}
      columns={columns(canCreateReceivable, openPlan, createReceivable)}
      contractFilter={contractRelationFilter}
      customerFilter={{}}
      dynamicFields={receivablePlanDynamicFields}
      errorMessage="回款计划列表暂时无法加载"
      label="回款计划数据工作区"
      load={(apiClient, query) => apiClient.getReceivablePlans(query)}
      primaryAction={{
        additionalAuthorities: ["contracts:read", "customers:read"],
        authority: "receivable-plans:write",
        key: "create-receivable-plan",
        label: "新建回款计划",
        onClick: () =>
          navigate(customerContextGlobalCreatePath("/crm/receivable-plans", location.search)),
      }}
      queryKey={(identityKey, query) => receivablePlanKeys.list(identityKey, query)}
      renderMobileItem={(plan) => (
        <Card
          size="small"
          title={
            plan.customerId === null ? (
              installmentLabel(plan.installment, plan.id)
            ) : (
              <Button type="link" onClick={() => openPlan(plan)}>
                {installmentLabel(plan.installment, plan.id)}
              </Button>
            )
          }
        >
          <Space orientation="vertical" size="small" style={{ display: "flex" }}>
            <Typography.Text>{reference("客户", plan.customerId)}</Typography.Text>
            <Typography.Text>{reference("合同", plan.contractId)}</Typography.Text>
            <Typography.Text>{`到期日期：${plan.dueDate ?? "未提供"}`}</Typography.Text>
            <Typography.Text>{`计划回款金额：${amount(plan.plannedAmount)}`}</Typography.Text>
            <Typography.Text>{`实际回款金额：${amount(plan.receivedAmount)}`}</Typography.Text>
            <Typography.Text>{`未回款金额：${amount(plan.remainingAmount)}`}</Typography.Text>
            <Space size="small" wrap>
              {plan.progress === null ? null : <Tag>{plan.progress}</Tag>}
              {plan.status === null ? null : <Tag>{plan.status}</Tag>}
            </Space>
            {canCreateReceivable && plan.customerId !== null && plan.contractId !== null ? (
              <Button type="link" onClick={() => createReceivable(plan)}>
                新建回款
              </Button>
            ) : null}
          </Space>
        </Card>
      )}
      searchLabel="搜索回款计划"
      searchPlaceholder="搜索回款计划期数"
      secondaryActions={[
        {
          authority: authority.receivablePlansExport,
          disabled: exportMutation.isPending,
          key: "export-receivable-plans-csv",
          label: exportMutation.isPending ? "正在导出…" : "导出 CSV",
          onClick: (query) => exportMutation.mutate(query),
        },
        {
          additionalAuthorities: ["contracts:read", "customers:read"],
          authority: "receivable-plans:write",
          key: "batch-create-receivable-plan",
          label: "批量新建",
          onClick: () =>
            navigate(
              customerContextGlobalBatchCreatePath("/crm/receivable-plans", location.search),
            ),
        },
      ]}
      summary={{
        additionalAuthorities: ["receivables:read"],
        load: (apiClient, query) => apiClient.getReceivablePlanSummary(query),
        queryKey: (identityKey, query) => receivablePlanKeys.summary(identityKey, query),
        render: (summary) => (
          <Space size="middle" wrap>
            <Typography.Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
              {`计划回款总金额：${amount(summary.plannedAmount)}`}
            </Typography.Text>
            <Typography.Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
              {`实际回款总金额：${amount(summary.receivedAmount)}`}
            </Typography.Text>
            <Typography.Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
              {`未回款总额：${amount(summary.remainingAmount)}`}
            </Typography.Text>
          </Space>
        ),
      }}
      supportsMine
      supportsSubordinates
      title="回款计划管理"
      toItem={toReceivablePlanListItem}
    />
  );
}
