import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  List,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { saveControlledDownload } from "~/api/client/controlled-download";
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
import { opportunityRelationFilter } from "~/components/entity-selector/opportunity-relation-filter";
import { formatServerAmount } from "~/shared/utils/format-server-amount";

import { ContractDetailDrawer } from "../components/contract-detail-drawer";
import { toContractListItem, type ContractListItem } from "../model/contract-list-item";
import { selectedContractIdFromSearch } from "../model/contract-list-route";
import {
  contractCustomSortOptions,
  contractListSortFromSearch,
  contractListSortLabel,
  contractListSortOptions,
  defaultContractListSort,
  resolveContractListSort,
  withContractListSort,
} from "../model/contract-list-sort";
import { contractKeys } from "../model/query-keys";

function reference(label: string, value: number | null): string {
  return value === null ? "—" : `${label} ${value}`;
}

function period(item: ContractListItem): string {
  return item.startDate === null && item.endDate === null
    ? "—"
    : `${item.startDate ?? "未提供"} 至 ${item.endDate ?? "未提供"}`;
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

function columns(onOpen: (contract: ContractListItem) => void): ColumnsType<ContractListItem> {
  return [
    {
      dataIndex: "number",
      key: "contract_number",
      title: "合同编号",
      render: (value: string | null, item) => (
        <Button data-detail-trigger-id={item.id} type="link" onClick={() => onOpen(item)}>
          {value || `合同 ${item.id}`}
        </Button>
      ),
    },
    {
      dataIndex: "name",
      key: "contract_name",
      title: "合同名称",
      render: (value: string | null, item) => (
        <Button data-detail-trigger-id={item.id} type="link" onClick={() => onOpen(item)}>
          {value || "—"}
        </Button>
      ),
    },
    {
      key: "customer",
      title: "客户",
      render: (_value: unknown, item) => `客户 ${item.customerId}`,
    },
    { key: "start_date", title: "履约期间", render: (_value: unknown, item) => period(item) },
    {
      dataIndex: "orderDate",
      key: "order_date",
      title: "签约日期",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "contactId",
      key: "contact",
      title: "联系人",
      render: (value: number | null) => reference("联系人", value),
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
      title: "状态",
      render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
    },
  ];
}

const contractColumnPreference: GlobalRecordListColumnPreference = {
  objectType: "CONTRACT",
  options: [
    { code: "contract_number", label: "合同编号" },
    { code: "contract_name", label: "合同名称" },
    { code: "customer", label: "客户" },
    { code: "start_date", label: "履约期间" },
    { code: "order_date", label: "签约日期" },
    { code: "contact", label: "联系人" },
    { code: "owner_actor", label: "负责人" },
    { code: "status", label: "状态" },
  ],
};

const contractColumnCodes = [
  "contract_number",
  "contract_name",
  "customer",
  "start_date",
  "order_date",
  "contact",
  "owner_actor",
  "status",
] as const;

const contractDynamicFields = {
  columnOptions: (fields: readonly FieldDefinition[]) =>
    dynamicListColumnOptions(fields, contractColumnCodes),
  columns: (fields: readonly FieldDefinition[]) =>
    dynamicListColumns<ContractListItem>(fields, contractColumnCodes),
  objectType: "CONTRACT",
};

const contractSortConfig: GlobalRecordListSortConfig<string> = {
  defaultSort: defaultContractListSort,
  fromSearch: contractListSortFromSearch,
  label: (sort, fields) =>
    contractListSortLabel(contractListSortFromSearch(`sort=${sort}`), fields),
  options: contractListSortOptions,
  customOptions: contractCustomSortOptions,
  resolve: (sort, fields) =>
    resolveContractListSort(contractListSortFromSearch(`sort=${sort}`), fields),
  withSort: (query, sort) =>
    withContractListSort(query, contractListSortFromSearch(`sort=${sort}`)),
};

type BatchCollaboratorMode = "add" | "remove";

export function ContractListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [batchOwnerPickerOpen, setBatchOwnerPickerOpen] = useState(false);
  const [batchOwnerKeyword, setBatchOwnerKeyword] = useState("");
  const [batchOwnerTargets, setBatchOwnerTargets] = useState<readonly ContractListItem[]>([]);
  const [batchCollaboratorPickerOpen, setBatchCollaboratorPickerOpen] = useState(false);
  const [batchCollaboratorKeyword, setBatchCollaboratorKeyword] = useState("");
  const [batchCollaboratorMode, setBatchCollaboratorMode] = useState<BatchCollaboratorMode>("add");
  const [batchCollaboratorTargets, setBatchCollaboratorTargets] = useState<
    readonly ContractListItem[]
  >([]);
  const [batchCollaboratorActorIds, setBatchCollaboratorActorIds] = useState<readonly number[]>([]);
  const [batchCollaboratorAccess, setBatchCollaboratorAccess] = useState<"READ" | "WRITE">("READ");
  const [batchCollaboratorEffectiveTime, setBatchCollaboratorEffectiveTime] = useState<
    "unlimited" | "until"
  >("unlimited");
  const [batchCollaboratorEffectiveUntil, setBatchCollaboratorEffectiveUntil] = useState<
    string | null
  >(null);
  const [batchSelectionResetKey, setBatchSelectionResetKey] = useState(0);
  const identityKey = authState?.identityKey ?? "pending";
  const canAssignContracts = hasAuthority(authorization, authority.contractsAssign);
  const canDeleteContracts = hasAuthority(authorization, authority.contractsDelete);
  const canExportSelectedContracts = hasAuthority(authorization, authority.contractsExport);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canBatchTransfer = canAssignContracts && canReadOrganization;
  const canBatchManageTeam = canAssignContracts && canReadOrganization;
  const selectedContractId = selectedContractIdFromSearch(searchParams.toString());
  const openContract = (contract: ContractListItem) => {
    setSearchParams(updateSearch(searchParams, { contractId: contract.id }));
  };
  const closeContractDrawer = () => {
    setSearchParams(updateSearch(searchParams, { contractId: undefined }));
  };
  const memberQuery = useQuery({
    queryKey: ["member-selector", "contract-batch-owner", identityKey, batchOwnerKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Contract owner selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: batchOwnerKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && batchOwnerPickerOpen && canReadOrganization,
  });
  const collaboratorMemberQuery = useQuery({
    queryKey: [
      "member-selector",
      "contract-batch-collaborator",
      batchCollaboratorMode,
      identityKey,
      batchCollaboratorKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Contract collaborator selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: batchCollaboratorKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && batchCollaboratorPickerOpen && canReadOrganization,
  });
  const batchOwnerMutation = useMutation({
    mutationFn: ({
      actorId,
      contracts,
    }: {
      actorId: number;
      contracts: readonly ContractListItem[];
    }) =>
      apiClient === null || contracts.length === 0
        ? Promise.reject(new Error("Contract owner batch update is unavailable."))
        : apiClient.updateContractOwners({
            contracts: contracts.map((contract) => ({
              contractId: contract.id,
              version: contract.version,
            })),
            ownerActorId: actorId,
          }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
      setBatchOwnerPickerOpen(false);
      setBatchOwnerKeyword("");
      setBatchOwnerTargets([]);
      setBatchSelectionResetKey((current) => current + 1);
      message.success(`已转移 ${variables.contracts.length} 份合同。`);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "合同负责人暂时无法批量更新");
    },
  });
  const batchDeleteMutation = useMutation({
    mutationFn: (contracts: readonly ContractListItem[]) =>
      apiClient === null || contracts.length === 0
        ? Promise.reject(new Error("Contract batch deletion is unavailable."))
        : apiClient.deleteContracts({
            contracts: contracts.map((contract) => ({
              contractId: contract.id,
              version: contract.version,
            })),
          }),
    onSuccess: (_result, contracts) => {
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
      setBatchSelectionResetKey((current) => current + 1);
      message.success(`已删除 ${contracts.length} 份合同。`);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "合同暂时无法批量删除");
    },
  });
  const batchExportMutation = useMutation({
    mutationFn: (contracts: readonly ContractListItem[]) =>
      apiClient === null || contracts.length === 0
        ? Promise.reject(new Error("Contract selected CSV export is unavailable."))
        : apiClient.exportSelectedContractsCsv({
            contracts: contracts.map((contract) => ({
              contractId: contract.id,
              version: contract.version,
            })),
          }),
    onSuccess: (download, contracts) => {
      saveControlledDownload(download);
      message.success(`已导出 ${contracts.length} 份合同。`);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "合同暂时无法导出");
    },
  });
  const batchCollaboratorMutation = useMutation({
    mutationFn: ({
      access,
      actorIds,
      contracts,
      effectiveUntil,
      mode,
    }: {
      access: "READ" | "WRITE" | null;
      actorIds: readonly number[];
      contracts: readonly ContractListItem[];
      effectiveUntil: string | null;
      mode: BatchCollaboratorMode;
    }) => {
      if (apiClient === null || contracts.length === 0 || actorIds.length === 0) {
        return Promise.reject(new Error("Contract batch collaborator update is unavailable."));
      }
      const targets = contracts.map((contract) => ({
        contractId: contract.id,
        version: contract.version,
      }));
      if (mode === "remove") {
        return apiClient.removeContractCollaborators({
          actorIds: [...actorIds],
          contracts: targets,
        });
      }
      if (access === null) {
        return Promise.reject(new Error("Contract collaborator access is unavailable."));
      }
      return apiClient.addContractCollaborators({
        collaborators: actorIds.map((actorId) => ({ access, actorId, effectiveUntil })),
        contracts: targets,
      });
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
      setBatchCollaboratorPickerOpen(false);
      setBatchCollaboratorKeyword("");
      setBatchCollaboratorTargets([]);
      setBatchCollaboratorActorIds([]);
      setBatchCollaboratorAccess("READ");
      setBatchCollaboratorEffectiveTime("unlimited");
      setBatchCollaboratorEffectiveUntil(null);
      setBatchSelectionResetKey((current) => current + 1);
      message.success(
        variables.mode === "add"
          ? `已为 ${variables.contracts.length} 份合同添加团队成员。`
          : `已从 ${variables.contracts.length} 份合同移除团队成员。`,
      );
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "合同团队成员暂时无法批量更新");
    },
  });
  const openBatchOwnerPicker = (contracts: readonly ContractListItem[]) => {
    setBatchOwnerTargets(contracts);
    setBatchOwnerPickerOpen(true);
  };
  const closeBatchOwnerPicker = () => {
    if (batchOwnerMutation.isPending) return;
    setBatchOwnerPickerOpen(false);
    setBatchOwnerKeyword("");
    setBatchOwnerTargets([]);
  };
  const openBatchCollaboratorPicker = (
    mode: BatchCollaboratorMode,
    contracts: readonly ContractListItem[],
  ) => {
    setBatchCollaboratorMode(mode);
    setBatchCollaboratorTargets(contracts);
    setBatchCollaboratorActorIds([]);
    setBatchCollaboratorAccess("READ");
    setBatchCollaboratorEffectiveTime("unlimited");
    setBatchCollaboratorEffectiveUntil(null);
    setBatchCollaboratorPickerOpen(true);
  };
  const closeBatchCollaboratorPicker = () => {
    if (batchCollaboratorMutation.isPending) return;
    setBatchCollaboratorPickerOpen(false);
    setBatchCollaboratorKeyword("");
    setBatchCollaboratorTargets([]);
    setBatchCollaboratorActorIds([]);
    setBatchCollaboratorAccess("READ");
    setBatchCollaboratorEffectiveTime("unlimited");
    setBatchCollaboratorEffectiveUntil(null);
  };
  const batchSelection: GlobalRecordListSelection<ContractListItem> | undefined =
    canBatchTransfer || canExportSelectedContracts || canBatchManageTeam || canDeleteContracts
      ? {
          renderActions: (contracts) => (
            <Space wrap>
              {canBatchTransfer ? (
                <Button
                  disabled={batchOwnerMutation.isPending}
                  onClick={() => openBatchOwnerPicker(contracts)}
                >
                  转移
                </Button>
              ) : null}
              {canExportSelectedContracts ? (
                <Button
                  disabled={batchExportMutation.isPending}
                  loading={batchExportMutation.isPending}
                  onClick={() => batchExportMutation.mutate(contracts)}
                >
                  导出选中
                </Button>
              ) : null}
              {canBatchManageTeam ? (
                <Button
                  disabled={batchCollaboratorMutation.isPending}
                  onClick={() => openBatchCollaboratorPicker("add", contracts)}
                >
                  添加团队成员
                </Button>
              ) : null}
              {canBatchManageTeam ? (
                <Button
                  disabled={batchCollaboratorMutation.isPending}
                  onClick={() => openBatchCollaboratorPicker("remove", contracts)}
                >
                  移除团队成员
                </Button>
              ) : null}
              {canDeleteContracts ? (
                <Popconfirm
                  cancelText="取消"
                  description="只有全部合同均无关联发票、回款和回款计划时才会删除；任一项不满足时，服务端不会删除其中任何合同。"
                  okButtonProps={{ danger: true, loading: batchDeleteMutation.isPending }}
                  okText="确认删除"
                  title={`确认删除选中的 ${contracts.length} 份合同？`}
                  onConfirm={() => batchDeleteMutation.mutate(contracts)}
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
      <GlobalRecordList<ContractListItem, components["schemas"]["ContractListSummaryResponse"]>
        authority="contracts:read"
        advancedFilter={{ entityLabel: "合同", objectType: "CONTRACT" }}
        columnPreference={contractColumnPreference}
        columns={columns(openContract)}
        customerFilter={{}}
        dynamicFields={contractDynamicFields}
        errorMessage="合同列表暂时无法加载"
        label="合同数据工作区"
        load={(apiClient, query) => apiClient.getContracts(query)}
        primaryAction={{
          additionalAuthorities: ["customers:read"],
          authority: "contracts:write",
          key: "create-contract",
          label: "新建合同",
          onClick: () =>
            navigate(customerContextGlobalCreatePath("/crm/contracts", location.search)),
        }}
        opportunityFilter={opportunityRelationFilter}
        queryKey={(identityKey, query) => contractKeys.list(identityKey, query)}
        renderMobileItem={(item) => (
          <Card size="small" title={item.name || item.number || `合同 ${item.id}`}>
            <Space orientation="vertical" size="small" style={{ display: "flex" }}>
              <Button
                data-detail-trigger-id={item.id}
                type="link"
                onClick={() => openContract(item)}
              >
                {item.number || `合同 ${item.id}`}
              </Button>
              <Typography.Text>{`客户 ${item.customerId}`}</Typography.Text>
              <Typography.Text>{period(item)}</Typography.Text>
              <Typography.Text>{reference("联系人", item.contactId)}</Typography.Text>
              <Typography.Text>{reference("成员", item.ownerActorId)}</Typography.Text>
              {item.status === null ? null : <Tag>{item.status}</Tag>}
            </Space>
          </Card>
        )}
        searchLabel="搜索合同"
        searchPlaceholder="搜索合同名称或编号"
        selection={batchSelection}
        sortConfig={contractSortConfig}
        summary={{
          additionalAuthorities: ["receivables:read"],
          load: (apiClient, query) => apiClient.getContractSummary(query),
          queryKey: (identityKey, query) => contractKeys.summary(identityKey, query),
          render: (summary) => (
            <Space aria-label="合同金额汇总" size={[24, 8]} wrap>
              <Typography.Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
                {`合同总金额：${formatServerAmount(summary.totalAmount)} 元`}
              </Typography.Text>
              <Typography.Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
                {`已回款金额：${formatServerAmount(summary.receivedAmount)} 元`}
              </Typography.Text>
              <Typography.Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
                {`未回款金额：${formatServerAmount(summary.outstandingAmount)} 元`}
              </Typography.Text>
            </Space>
          ),
        }}
        supportsMine
        supportsSubordinates
        statusOptions={[
          { label: "生效", value: "ACTIVE" },
          { label: "已作废", value: "VOIDED" },
        ]}
        title="合同管理"
        toItem={toContractListItem}
      />
      <Modal
        destroyOnHidden
        footer={null}
        open={batchOwnerPickerOpen}
        title="批量转移负责人"
        onCancel={closeBatchOwnerPicker}
      >
        <Typography.Paragraph type="secondary">
          {`将为 ${batchOwnerTargets.length} 份已选合同设置同一负责人。仅显示服务端允许当前成员查看的在职成员，最终可分配范围、字段权限和并发仍由服务端校验。`}
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
                        contracts: batchOwnerTargets,
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
      <Modal
        destroyOnHidden
        footer={null}
        open={batchCollaboratorPickerOpen}
        title={batchCollaboratorMode === "add" ? "添加团队成员" : "移除团队成员"}
        onCancel={closeBatchCollaboratorPicker}
      >
        <Typography.Paragraph type="secondary">
          {batchCollaboratorMode === "add"
            ? `将为 ${batchCollaboratorTargets.length} 份已选合同添加或更新团队成员，原有未选成员会保留。`
            : `将从 ${batchCollaboratorTargets.length} 份已选合同移除同一团队成员；负责人不能通过此操作移除。`}
        </Typography.Paragraph>
        {batchCollaboratorMode === "remove" ? (
          <Input.Search
            allowClear
            defaultValue={batchCollaboratorKeyword}
            placeholder="按成员姓名搜索"
            onSearch={(keyword) => setBatchCollaboratorKeyword(keyword)}
          />
        ) : null}
        {collaboratorMemberQuery.isError ? (
          <Alert title="成员列表暂时无法加载" showIcon style={{ marginTop: 12 }} type="error" />
        ) : batchCollaboratorMode === "add" ? (
          <>
            <Typography.Text strong style={{ display: "block", marginTop: 16 }}>
              *选择团队成员
            </Typography.Text>
            <Select
              aria-label="选择团队成员"
              disabled={batchCollaboratorMutation.isPending}
              filterOption={false}
              loading={collaboratorMemberQuery.isLoading}
              maxCount={100}
              mode="multiple"
              notFoundContent={
                collaboratorMemberQuery.isLoading ? "正在加载成员" : "未找到可选择成员"
              }
              options={(collaboratorMemberQuery.data ?? []).map((member) => ({
                label: `${member.displayName}（成员 ${member.actorId}）`,
                value: member.actorId,
              }))}
              placeholder="点击选择（多选）"
              showSearch
              style={{ display: "block", marginTop: 8, width: "100%" }}
              value={[...batchCollaboratorActorIds]}
              onChange={(actorIds) => setBatchCollaboratorActorIds(actorIds)}
              onSearch={setBatchCollaboratorKeyword}
            />
            <Typography.Text strong style={{ display: "block", marginTop: 16 }}>
              权限
            </Typography.Text>
            <Radio.Group
              aria-label="团队成员权限"
              disabled={batchCollaboratorMutation.isPending}
              style={{ marginTop: 8 }}
              value={batchCollaboratorAccess}
              onChange={(event) => setBatchCollaboratorAccess(event.target.value)}
            >
              <Radio value="READ">只读</Radio>
              <Radio value="WRITE">读写</Radio>
            </Radio.Group>
            <Typography.Text strong style={{ display: "block", marginTop: 16 }}>
              有效时间
            </Typography.Text>
            <Select
              aria-label="团队成员有效时间"
              disabled={batchCollaboratorMutation.isPending}
              options={[
                { label: "不限", value: "unlimited" },
                { label: "截止到", value: "until" },
              ]}
              placeholder="请选择"
              style={{ display: "block", marginTop: 8, width: "100%" }}
              value={batchCollaboratorEffectiveTime}
              onChange={(next: "unlimited" | "until") => {
                setBatchCollaboratorEffectiveTime(next);
                if (next === "unlimited") setBatchCollaboratorEffectiveUntil(null);
              }}
            />
            {batchCollaboratorEffectiveTime === "until" ? (
              <DatePicker
                allowClear={false}
                aria-label="团队成员有效截至日期"
                disabled={batchCollaboratorMutation.isPending}
                disabledDate={(date) => date.endOf("day").isBefore(dayjs().startOf("day"))}
                placeholder="请选择截至日期"
                style={{ display: "block", marginTop: 12, width: "100%" }}
                value={
                  batchCollaboratorEffectiveUntil === null
                    ? null
                    : dayjs(batchCollaboratorEffectiveUntil, "YYYY-MM-DD", true)
                }
                onChange={(date) =>
                  setBatchCollaboratorEffectiveUntil(date?.format("YYYY-MM-DD") ?? null)
                }
              />
            ) : null}
            <Space style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <Button
                disabled={batchCollaboratorMutation.isPending}
                onClick={closeBatchCollaboratorPicker}
              >
                取消
              </Button>
              <Button
                disabled={
                  batchCollaboratorActorIds.length === 0 ||
                  batchCollaboratorTargets.length === 0 ||
                  (batchCollaboratorEffectiveTime === "until" &&
                    batchCollaboratorEffectiveUntil === null)
                }
                loading={batchCollaboratorMutation.isPending}
                type="primary"
                onClick={() =>
                  batchCollaboratorMutation.mutate({
                    access: batchCollaboratorAccess,
                    actorIds: batchCollaboratorActorIds,
                    contracts: batchCollaboratorTargets,
                    effectiveUntil:
                      batchCollaboratorEffectiveTime === "until"
                        ? batchCollaboratorEffectiveUntil
                        : null,
                    mode: "add",
                  })
                }
              >
                保存
              </Button>
            </Space>
          </>
        ) : (
          <List
            dataSource={[...(collaboratorMemberQuery.data ?? [])]}
            loading={collaboratorMemberQuery.isLoading}
            locale={{ emptyText: "未找到可选择成员" }}
            renderItem={(member) => (
              <List.Item
                actions={[
                  <Popconfirm
                    cancelText="取消"
                    key={`${member.actorId}-remove`}
                    okButtonProps={{ danger: true, loading: batchCollaboratorMutation.isPending }}
                    okText="确认移除"
                    title={`确认从已选合同移除 ${member.displayName}？`}
                    onConfirm={() =>
                      batchCollaboratorMutation.mutate({
                        access: null,
                        actorIds: [member.actorId],
                        contracts: batchCollaboratorTargets,
                        effectiveUntil: null,
                        mode: "remove",
                      })
                    }
                  >
                    <Button
                      danger
                      disabled={
                        batchCollaboratorMutation.isPending || batchCollaboratorTargets.length === 0
                      }
                      loading={batchCollaboratorMutation.isPending}
                      type="link"
                    >
                      移除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta description={`成员 ${member.actorId}`} title={member.displayName} />
              </List.Item>
            )}
          />
        )}
      </Modal>
      <ContractDetailDrawer
        contractId={selectedContractId}
        customerId={null}
        open={selectedContractId !== null}
        onClose={closeContractDrawer}
      />
    </>
  );
}
