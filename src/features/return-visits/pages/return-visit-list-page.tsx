import { Button, Card, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import {
  GlobalRecordList,
  type GlobalRecordListColumnPreference,
  type GlobalRecordListSortConfig,
} from "~/components/data-view/global-record-list";
import {
  dynamicListColumnOptions,
  dynamicListColumns,
} from "~/components/data-view/dynamic-list-columns";
import type { FieldDefinition } from "~/components/dynamic-field";
import { contractRelationFilter } from "~/components/entity-selector/contract-relation-filter";
import { ApprovalStatusTag } from "~/features/approvals";

import { ReturnVisitDetailDrawer } from "../components/return-visit-detail-drawer";
import { returnVisitKeys } from "../model/query-keys";
import { returnVisitFormLabel, returnVisitSatisfactionLabel } from "../model/return-visit-fields";
import { toReturnVisitListItem, type ReturnVisitListItem } from "../model/return-visit-list-item";
import {
  defaultReturnVisitListSort,
  resolveReturnVisitListSort,
  returnVisitCustomSortOptions,
  returnVisitListSortFromSearch,
  returnVisitListSortLabel,
  returnVisitListSortOptions,
  withReturnVisitListSort,
} from "../model/return-visit-list-sort";
import {
  returnVisitCreatePath,
  returnVisitEditPath,
  selectedReturnVisitIdFromSearch,
} from "../model/return-visit-list-route";

function reference(label: string, value: number | null): string {
  return value === null ? "—" : `${label} ${value}`;
}

function detail(item: ReturnVisitListItem, onOpen: (returnVisitId: number) => void) {
  return (
    <Button data-detail-trigger-id={item.id} type="link" onClick={() => onOpen(item.id)}>
      {item.visitNumber || `回访 ${item.id}`}
    </Button>
  );
}

function columns(onOpen: (returnVisitId: number) => void): ColumnsType<ReturnVisitListItem> {
  return [
    {
      dataIndex: "visitNumber",
      key: "visit_number",
      title: "回访编号",
      render: (_value: string | null, item) => detail(item, onOpen),
    },
    {
      dataIndex: "customerId",
      key: "customer",
      title: "客户",
      render: (value: number | null) => reference("客户", value),
    },
    {
      dataIndex: "visitTime",
      key: "visit_time",
      title: "回访时间",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "visitForm",
      key: "visit_form",
      title: "回访形式",
      render: (value) => returnVisitFormLabel(value),
    },
    {
      dataIndex: "satisfaction",
      key: "satisfaction",
      title: "客户满意度",
      render: (value) => returnVisitSatisfactionLabel(value),
    },
    {
      dataIndex: "remark",
      key: "remark",
      title: "客户反馈",
      render: (value: string | null) => value || "—",
    },
    {
      dataIndex: "contactId",
      key: "contact",
      title: "联系人",
      render: (value: number | null) => reference("联系人", value),
    },
    {
      dataIndex: "contractId",
      key: "contract",
      title: "合同",
      render: (value: number | null) => reference("合同", value),
    },
    {
      dataIndex: "ownerActorId",
      key: "owner_actor",
      title: "负责人",
      render: (value: number | null) => reference("成员", value),
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
  ];
}

const returnVisitColumnCodes = [
  "visit_number",
  "customer",
  "visit_time",
  "visit_form",
  "satisfaction",
  "remark",
  "contact",
  "contract",
  "owner_actor",
  "status",
  "approval_status",
] as const;

const returnVisitColumnPreference: GlobalRecordListColumnPreference = {
  objectType: "RETURN_VISIT",
  options: [
    { code: "visit_number", label: "回访编号" },
    { code: "customer", label: "客户" },
    { code: "visit_time", label: "回访时间" },
    { code: "visit_form", label: "回访形式" },
    { code: "satisfaction", label: "客户满意度" },
    { code: "remark", label: "客户反馈" },
    { code: "contact", label: "联系人" },
    { code: "contract", label: "合同" },
    { code: "owner_actor", label: "负责人" },
    { code: "status", label: "记录状态" },
    { code: "approval_status", label: "审批状态" },
  ],
};

const returnVisitDynamicFields = {
  columnOptions: (fields: readonly FieldDefinition[]) =>
    dynamicListColumnOptions(fields, returnVisitColumnCodes),
  columns: (fields: readonly FieldDefinition[]) =>
    dynamicListColumns<ReturnVisitListItem>(fields, returnVisitColumnCodes),
  objectType: "RETURN_VISIT",
};

const returnVisitSortConfig: GlobalRecordListSortConfig<string> = {
  defaultSort: defaultReturnVisitListSort,
  fromSearch: returnVisitListSortFromSearch,
  label: (sort, fields) =>
    returnVisitListSortLabel(returnVisitListSortFromSearch(`sort=${sort}`), fields),
  options: returnVisitListSortOptions,
  customOptions: returnVisitCustomSortOptions,
  resolve: (sort, fields) =>
    resolveReturnVisitListSort(returnVisitListSortFromSearch(`sort=${sort}`), fields),
  withSort: (query, sort) =>
    withReturnVisitListSort(query, returnVisitListSortFromSearch(`sort=${sort}`)),
};

export function ReturnVisitListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedReturnVisitId = selectedReturnVisitIdFromSearch(searchParams.toString());

  function updateSearch(next: URLSearchParams) {
    setSearchParams(next, { replace: true });
  }

  function openDetail(returnVisitId: number) {
    const next = new URLSearchParams(searchParams);
    next.set("returnVisitId", String(returnVisitId));
    updateSearch(next);
  }

  function closeDetail() {
    const next = new URLSearchParams(searchParams);
    next.delete("returnVisitId");
    updateSearch(next);
  }

  return (
    <>
      <GlobalRecordList
        authority="return-visits:read"
        advancedFilter={{ entityLabel: "回访", objectType: "RETURN_VISIT" }}
        columnPreference={returnVisitColumnPreference}
        columns={columns(openDetail)}
        contractFilter={contractRelationFilter}
        customerFilter={{}}
        dynamicFields={returnVisitDynamicFields}
        errorMessage="回访列表暂时无法加载"
        label="回访数据工作区"
        load={(apiClient, query) => apiClient.getReturnVisits(query)}
        primaryAction={{
          additionalAuthorities: ["customers:read"],
          authority: "return-visits:write",
          key: "create-return-visit",
          label: "新建回访",
          onClick: () => navigate(returnVisitCreatePath(location.search)),
        }}
        queryKey={(identityKey, query) => returnVisitKeys.list(identityKey, query)}
        renderMobileItem={(item) => (
          <Card size="small" title={item.visitNumber || `回访 ${item.id}`}>
            <Space orientation="vertical" size="small" style={{ display: "flex" }}>
              {detail(item, openDetail)}
              <Typography.Text>{reference("客户", item.customerId)}</Typography.Text>
              <Typography.Text>{item.visitTime ?? "未提供回访时间"}</Typography.Text>
              <Typography.Text>回访形式：{returnVisitFormLabel(item.visitForm)}</Typography.Text>
              <Typography.Text>
                客户满意度：{returnVisitSatisfactionLabel(item.satisfaction)}
              </Typography.Text>
              <Typography.Text>{item.remark || "暂无客户反馈"}</Typography.Text>
              <Typography.Text>{reference("联系人", item.contactId)}</Typography.Text>
              <Typography.Text>{reference("合同", item.contractId)}</Typography.Text>
              <Typography.Text>{reference("成员", item.ownerActorId)}</Typography.Text>
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
        searchLabel="搜索回访"
        searchPlaceholder="搜索回访编号或关键词"
        sortConfig={returnVisitSortConfig}
        supportsMine
        supportsSubordinates
        title="回访管理"
        toItem={toReturnVisitListItem}
      />
      <ReturnVisitDetailDrawer
        open={selectedReturnVisitId !== null}
        returnVisitId={selectedReturnVisitId}
        onClose={closeDetail}
        onEdit={(customerId, returnVisitId) =>
          navigate(returnVisitEditPath(customerId, returnVisitId, location.search))
        }
      />
    </>
  );
}
