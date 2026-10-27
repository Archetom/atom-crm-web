import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  List,
  Modal,
  Pagination,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Switch,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict, requiresConflictRefresh } from "~/api/errors/mutation-conflict";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  normalizePageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";
import type { DepartmentOption } from "~/components/entity-selector/department-option";
import type { MemberOption } from "~/components/entity-selector/member-option";
import { MutationConflictNotice } from "~/components/feedback/mutation-conflict-notice";
import { DataWorkspace } from "~/components/page/data-workspace";
import { FilterBar } from "~/components/page/filter-bar";
import { PageHeader } from "~/components/page/page-header";

import {
  toCustomerPoolConfiguration,
  type CustomerPoolConfiguration,
  type CustomerPoolRule,
  type CustomerPoolRuleType,
} from "../model/customer-pool-configuration";
import type { CustomerPoolStatus } from "../model/customer-pool-catalog";
import { customerPoolKeys } from "../model/query-keys";

import styles from "./customer-pool-customers-page.module.css";

function statusLabel(status: CustomerPoolStatus): string {
  if (status === "ACTIVE") return "启用";
  if (status === "INACTIVE") return "停用";
  return "已删除";
}

function statusColor(status: CustomerPoolStatus): string | undefined {
  if (status === "ACTIVE") return "green";
  if (status === "INACTIVE") return "default";
  return "red";
}

function ruleLabel(type: CustomerPoolRuleType): string {
  return type === "STALE_UPDATE" ? "未更新" : "未赢单";
}

function updateSearch(
  current: URLSearchParams,
  update: Record<string, number | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined) next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}

const columns: ColumnsType<CustomerPoolConfiguration> = [
  { dataIndex: "name", key: "name", title: "公海名称" },
  {
    dataIndex: "status",
    key: "status",
    title: "状态",
    render: (status: CustomerPoolStatus) => (
      <Tag color={statusColor(status)}>{statusLabel(status)}</Tag>
    ),
  },
  {
    dataIndex: "customerCount",
    key: "customerCount",
    title: "客户",
    render: (count: number) => `${count} 位`,
  },
  {
    dataIndex: "administratorActorIds",
    key: "administrators",
    title: "管理员",
    render: (actorIds: readonly number[]) =>
      actorIds.length === 0 ? "—" : actorIds.map((actorId) => `成员 ${actorId}`).join("、"),
  },
  {
    key: "eligibility",
    title: "领取成员范围",
    render: (_, pool) =>
      `成员 ${pool.eligibleActorIds.length} / 部门 ${pool.eligibleDepartmentIds.length}`,
  },
  {
    key: "claimRules",
    title: "领取规则",
    render: (_, pool) =>
      `日上限 ${pool.dailyClaimLimit || "不限"}；原负责人冷却 ${pool.previousOwnerCooldownDays} 天`,
  },
  {
    dataIndex: "automaticReleaseEnabled",
    key: "automaticReleaseEnabled",
    title: "自动释放",
    render: (enabled: boolean) => (enabled ? <Tag color="blue">已启用</Tag> : "未启用"),
  },
];

export function CustomerPoolConfigurationListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [administratorCandidates, setAdministratorCandidates] = useState<readonly MemberOption[]>(
    [],
  );
  const [administratorKeyword, setAdministratorKeyword] = useState("");
  const [editingPool, setEditingPool] = useState<CustomerPoolConfiguration | null>(null);
  const [transferSourcePool, setTransferSourcePool] = useState<CustomerPoolConfiguration | null>(
    null,
  );
  const [transferTargetPool, setTransferTargetPool] = useState<CustomerPoolConfiguration | null>(
    null,
  );
  const [transferTargetPage, setTransferTargetPage] = useState(1);
  const [editName, setEditName] = useState("");
  const [editDailyClaimLimit, setEditDailyClaimLimit] = useState(0);
  const [editCooldownDays, setEditCooldownDays] = useState(0);
  const [editAutomaticReleaseEnabled, setEditAutomaticReleaseEnabled] = useState(false);
  const [editRules, setEditRules] = useState<readonly CustomerPoolRule[]>([]);
  const [editAdministratorActorIds, setEditAdministratorActorIds] = useState<readonly number[]>([]);
  const [editEligibleActorIds, setEditEligibleActorIds] = useState<readonly number[]>([]);
  const [editEligibleDepartmentIds, setEditEligibleDepartmentIds] = useState<readonly number[]>([]);
  const [eligibilityMemberKeyword, setEligibilityMemberKeyword] = useState("");
  const [editReviewRequired, setEditReviewRequired] = useState(false);
  const search = searchParams.toString();
  const request = useMemo(() => {
    const params = new URLSearchParams(search);
    return normalizePageRequest({
      page: Number.parseInt(params.get("page") ?? "", 10),
      size: Number.parseInt(params.get("size") ?? "", 10),
    });
  }, [search]);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const configurationsQuery = useQuery({
    queryKey: customerPoolKeys.configurations(identityKey, request),
    queryFn: () =>
      apiClient?.getCustomerPoolConfigurations(request) ??
      Promise.reject(new Error("Customer-pool configuration API is unavailable.")),
    enabled: apiClient !== null,
  });
  const administratorQuery = useQuery({
    queryKey: [
      "member-selector",
      "customer-pool-create",
      identityKey,
      administratorKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer-pool administrator selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: administratorKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && createOpen && canReadOrganization,
  });
  const eligibilityMemberQuery = useQuery({
    queryKey: [
      "member-selector",
      "customer-pool-eligibility",
      identityKey,
      eligibilityMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer-pool eligibility selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: eligibilityMemberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && editingPool !== null && canReadOrganization,
  });
  const departmentQuery = useQuery({
    queryKey: ["department-selector", "customer-pool-eligibility", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer-pool department selection is unavailable."))
        : apiClient.getVisibleDepartments(),
    enabled: apiClient !== null && editingPool !== null && canReadOrganization,
  });
  const transferTargetsQuery = useQuery({
    queryKey: customerPoolKeys.configurations(identityKey, {
      page: transferTargetPage,
      size: 20,
    }),
    queryFn: () =>
      apiClient?.getCustomerPoolConfigurations({ page: transferTargetPage, size: 20 }) ??
      Promise.reject(new Error("Customer-pool transfer target API is unavailable.")),
    enabled: apiClient !== null && transferSourcePool !== null,
  });
  const createMutation = useMutation({
    mutationFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer-pool create API is unavailable."))
        : apiClient.createCustomerPool({
            name: createName.trim(),
            administratorActorIds: administratorCandidates.map((member) => member.actorId),
            eligibleActorIds: administratorCandidates.map((member) => member.actorId),
            eligibleDepartmentIds: [],
            dailyClaimLimit: 0,
            previousOwnerCooldownDays: 0,
            automaticReleaseEnabled: false,
            rules: [],
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
      setCreateOpen(false);
      setCreateName("");
      setAdministratorCandidates([]);
      setAdministratorKeyword("");
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ active, pool }: { active: boolean; pool: CustomerPoolConfiguration }) =>
      apiClient === null
        ? Promise.reject(new Error("Customer-pool status API is unavailable."))
        : apiClient.updateCustomerPoolStatus(pool.id, { active, version: pool.version }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      pool,
      request,
    }: {
      pool: CustomerPoolConfiguration;
      request: Parameters<NonNullable<typeof apiClient>["updateCustomerPool"]>[1];
    }) =>
      apiClient === null
        ? Promise.reject(new Error("Customer-pool update API is unavailable."))
        : apiClient.updateCustomerPool(pool.id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
      closeEdit(true);
    },
  });
  const transferMutation = useMutation({
    mutationFn: ({
      sourcePool,
      targetPool,
    }: {
      sourcePool: CustomerPoolConfiguration;
      targetPool: CustomerPoolConfiguration;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("Customer-pool transfer API is unavailable."))
        : apiClient.transferCustomerPool(sourcePool.id, { targetPoolId: targetPool.id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
      closeTransfer(true);
    },
  });
  const deletePoolMutation = useMutation({
    mutationFn: (pool: CustomerPoolConfiguration) =>
      apiClient === null
        ? Promise.reject(new Error("Customer-pool delete API is unavailable."))
        : apiClient.deleteCustomerPool(pool.id, pool.version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
    },
  });
  const page: PageResult<CustomerPoolConfiguration> = configurationsQuery.data
    ? toPageResult(configurationsQuery.data, toCustomerPoolConfiguration)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };

  function setPage(nextPage: number, nextSize: number) {
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function openCreate() {
    createMutation.reset();
    setCreateName("");
    setAdministratorCandidates([]);
    setAdministratorKeyword("");
    setCreateOpen(true);
  }

  function closeCreate() {
    if (createMutation.isPending) return;
    createMutation.reset();
    setCreateOpen(false);
    setCreateName("");
    setAdministratorCandidates([]);
    setAdministratorKeyword("");
  }

  function addAdministrator(member: MemberOption) {
    setAdministratorCandidates((current) =>
      current.some((candidate) => candidate.actorId === member.actorId)
        ? current
        : [...current, member],
    );
  }

  function removeAdministrator(actorId: number) {
    setAdministratorCandidates((current) =>
      current.filter((candidate) => candidate.actorId !== actorId),
    );
  }

  function openEdit(pool: CustomerPoolConfiguration) {
    updateMutation.reset();
    setEditingPool(pool);
    setEditName(pool.name);
    setEditDailyClaimLimit(pool.dailyClaimLimit);
    setEditCooldownDays(pool.previousOwnerCooldownDays);
    setEditAutomaticReleaseEnabled(pool.automaticReleaseEnabled);
    setEditRules(pool.rules);
    setEditAdministratorActorIds(pool.administratorActorIds);
    setEditEligibleActorIds(pool.eligibleActorIds);
    setEditEligibleDepartmentIds(pool.eligibleDepartmentIds);
    setEligibilityMemberKeyword("");
    setEditReviewRequired(false);
  }

  function closeEdit(force = false) {
    if (!force && updateMutation.isPending) return;
    updateMutation.reset();
    setEditingPool(null);
    setEditName("");
    setEditDailyClaimLimit(0);
    setEditCooldownDays(0);
    setEditAutomaticReleaseEnabled(false);
    setEditRules([]);
    setEditAdministratorActorIds([]);
    setEditEligibleActorIds([]);
    setEditEligibleDepartmentIds([]);
    setEligibilityMemberKeyword("");
    setEditReviewRequired(false);
  }

  function openTransfer(pool: CustomerPoolConfiguration) {
    transferMutation.reset();
    setTransferSourcePool(pool);
    setTransferTargetPool(null);
    setTransferTargetPage(1);
  }

  function closeTransfer(force = false) {
    if (!force && transferMutation.isPending) return;
    transferMutation.reset();
    setTransferSourcePool(null);
    setTransferTargetPool(null);
    setTransferTargetPage(1);
  }

  function addRule(type: CustomerPoolRuleType) {
    setEditRules((current) =>
      current.some((rule) => rule.type === type)
        ? current
        : [...current, { type, inactiveDays: 30 }],
    );
  }

  function updateRuleDays(type: CustomerPoolRuleType, inactiveDays: number) {
    setEditRules((current) =>
      current.map((rule) => (rule.type === type ? { ...rule, inactiveDays } : rule)),
    );
  }

  function removeRule(type: CustomerPoolRuleType) {
    setEditRules((current) => current.filter((rule) => rule.type !== type));
  }

  function addEligibleMember(member: MemberOption) {
    setEditEligibleActorIds((current) =>
      current.includes(member.actorId) || current.length >= 500
        ? current
        : [...current, member.actorId],
    );
  }

  function addEditAdministrator(member: MemberOption) {
    setEditAdministratorActorIds((current) =>
      current.includes(member.actorId) || current.length >= 50
        ? current
        : [...current, member.actorId],
    );
    setEditEligibleActorIds((current) =>
      current.includes(member.actorId) || current.length >= 500
        ? current
        : [...current, member.actorId],
    );
  }

  function removeEditAdministrator(actorId: number) {
    setEditAdministratorActorIds((current) => current.filter((candidate) => candidate !== actorId));
  }

  function removeEligibleMember(actorId: number) {
    setEditEligibleActorIds((current) => current.filter((candidate) => candidate !== actorId));
  }

  function addEligibleDepartment(department: DepartmentOption) {
    setEditEligibleDepartmentIds((current) =>
      current.includes(department.departmentId) || current.length >= 200
        ? current
        : [...current, department.departmentId],
    );
  }

  function removeEligibleDepartment(departmentId: number) {
    setEditEligibleDepartmentIds((current) =>
      current.filter((candidate) => candidate !== departmentId),
    );
  }

  const canSubmitCreate =
    createName.trim().length > 0 &&
    createName.trim().length <= 100 &&
    administratorCandidates.length > 0 &&
    administratorCandidates.length <= 50;
  const canSubmitEdit =
    editingPool !== null &&
    editName.trim().length > 0 &&
    editName.trim().length <= 100 &&
    editDailyClaimLimit >= 0 &&
    editDailyClaimLimit <= 10_000 &&
    editCooldownDays >= 0 &&
    editCooldownDays <= 3650 &&
    editAdministratorActorIds.length > 0 &&
    editAdministratorActorIds.length <= 50 &&
    editEligibleActorIds.length <= 500 &&
    editEligibleDepartmentIds.length <= 200 &&
    (editEligibleActorIds.length > 0 || editEligibleDepartmentIds.length > 0) &&
    editRules.every((rule) => rule.inactiveDays >= 1 && rule.inactiveDays <= 3650) &&
    (!editAutomaticReleaseEnabled || editRules.length > 0);
  const eligibleMemberNames = useMemo(
    () =>
      new Map(
        (eligibilityMemberQuery.data ?? []).map((member) => [member.actorId, member.displayName]),
      ),
    [eligibilityMemberQuery.data],
  );
  const eligibleDepartmentNames = useMemo(
    () =>
      new Map(
        (departmentQuery.data ?? []).map((department) => [
          department.departmentId,
          department.name,
        ]),
      ),
    [departmentQuery.data],
  );
  const transferTargetPageResult: PageResult<CustomerPoolConfiguration> = transferTargetsQuery.data
    ? toPageResult(transferTargetsQuery.data, toCustomerPoolConfiguration)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };
  const statusConflict = statusMutation.isError ? getMutationConflict(statusMutation.error) : null;
  const updateConflict = updateMutation.isError ? getMutationConflict(updateMutation.error) : null;
  const transferConflict = transferMutation.isError
    ? getMutationConflict(transferMutation.error)
    : null;
  const deletePoolConflict = deletePoolMutation.isError
    ? getMutationConflict(deletePoolMutation.error)
    : null;

  function refreshAfterStatusConflict() {
    statusMutation.reset();
    void queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
  }

  function refreshAfterDeletePoolConflict() {
    deletePoolMutation.reset();
    void queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
  }

  async function resolveUpdateConflict(
    resolution: "dismiss" | "keep-draft-and-reload" | "discard-draft-and-reload",
  ) {
    if (resolution === "dismiss") {
      updateMutation.reset();
      return;
    }

    await queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
    updateMutation.reset();
    if (resolution === "keep-draft-and-reload") {
      setEditReviewRequired(true);
      return;
    }

    closeEdit();
  }

  async function resolveTransferConflict(
    resolution: "dismiss" | "keep-draft-and-reload" | "discard-draft-and-reload",
  ) {
    if (resolution === "dismiss") {
      transferMutation.reset();
      return;
    }

    await queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
    transferMutation.reset();
    if (resolution === "discard-draft-and-reload") closeTransfer();
  }

  function submitEdit() {
    if (editingPool === null || !canSubmitEdit || editReviewRequired) return;

    updateMutation.mutate({
      pool: editingPool,
      request: {
        version: editingPool.version,
        name: editName.trim(),
        administratorActorIds: [...editAdministratorActorIds],
        eligibleActorIds: [...editEligibleActorIds],
        eligibleDepartmentIds: [...editEligibleDepartmentIds],
        dailyClaimLimit: editDailyClaimLimit,
        previousOwnerCooldownDays: editCooldownDays,
        automaticReleaseEnabled: editAutomaticReleaseEnabled,
        rules: [...editRules],
      },
    });
  }

  function renderEditAction(pool: CustomerPoolConfiguration) {
    if (!pool.administrator) return null;

    return (
      <Button size="small" type="link" onClick={() => openEdit(pool)}>
        编辑配置
      </Button>
    );
  }

  function renderStatusAction(pool: CustomerPoolConfiguration) {
    if (!pool.administrator) return "—";

    const active = pool.status === "ACTIVE";
    const cannotDeactivate = active && pool.customerCount > 0;
    const nextAction = active ? "停用公海" : "启用公海";
    const isPending = statusMutation.isPending && statusMutation.variables?.pool.id === pool.id;
    const button = (
      <Button disabled={cannotDeactivate} loading={isPending} size="small" type="link">
        {nextAction}
      </Button>
    );

    if (cannotDeactivate) {
      return (
        <Tooltip title="公海内仍有客户，服务端不允许停用。">
          <span>{button}</span>
        </Tooltip>
      );
    }

    return (
      <Popconfirm
        cancelText="取消"
        description={
          active
            ? "停用后，该公海不再接受客户入池或领取。"
            : "启用后，满足服务端资格条件的成员可重新使用该公海。"
        }
        okText={active ? "确认停用" : "确认启用"}
        title={active ? `停用“${pool.name}”？` : `启用“${pool.name}”？`}
        onConfirm={() => statusMutation.mutate({ active: !active, pool })}
      >
        {button}
      </Popconfirm>
    );
  }

  function renderTransferAction(pool: CustomerPoolConfiguration) {
    if (!pool.administrator || pool.customerCount === 0) return null;

    return (
      <Button size="small" type="link" onClick={() => openTransfer(pool)}>
        转移客户
      </Button>
    );
  }

  function renderDeletePoolAction(pool: CustomerPoolConfiguration) {
    if (!pool.administrator) return null;

    const cannotDelete = pool.customerCount > 0;
    const isPending = deletePoolMutation.isPending && deletePoolMutation.variables?.id === pool.id;
    const button = (
      <Button disabled={cannotDelete} loading={isPending} size="small" type="link" danger>
        删除公海
      </Button>
    );

    if (cannotDelete) {
      return (
        <Tooltip title="公海内仍有客户，请先转移或处理客户后再删除。">
          <span>{button}</span>
        </Tooltip>
      );
    }

    return (
      <Popconfirm
        cancelText="取消"
        description="删除后，公海配置不再可用。服务端会再次确认该公海为空且版本未变化。"
        okButtonProps={{ danger: true }}
        okText="确认删除"
        title={`删除“${pool.name}”？`}
        onConfirm={() => deletePoolMutation.mutate(pool)}
      >
        {button}
      </Popconfirm>
    );
  }

  const configurationColumns: ColumnsType<CustomerPoolConfiguration> = [
    ...columns,
    {
      key: "actions",
      title: "操作",
      render: (_, pool) =>
        pool.administrator ? (
          <Space size={0}>
            {renderEditAction(pool)}
            {renderStatusAction(pool)}
            {renderTransferAction(pool)}
            {renderDeletePoolAction(pool)}
          </Space>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <RouteAuthority authority={authority.customerPoolsManage}>
      <main>
        <PageHeader
          description={
            <>
              <Link to="/crm/customer-pools">返回客户公海</Link>
              {" · 配置、成员资格、自动释放与状态只显示服务端管理接口明确返回的数据。"}
            </>
          }
          title="客户公海管理"
        />
        <FilterBar
          trailing={
            <Button type="primary" onClick={openCreate}>
              新建客户公海
            </Button>
          }
        />
        <DataWorkspace
          errorMessage={
            configurationsQuery.isError && !configurationsQuery.isLoading
              ? configurationsQuery.error instanceof ApiError
                ? configurationsQuery.error.message
                : "客户公海配置暂时无法加载"
              : undefined
          }
          label="客户公海配置工作区"
        >
          {configurationsQuery.isLoading && configurationsQuery.data === undefined ? (
            <div
              aria-label="正在加载客户公海配置"
              style={{ display: "grid", minHeight: 240, placeItems: "center" }}
            >
              <Spin size="large" />
            </div>
          ) : (
            <ResponsiveDataList
              columns={configurationColumns}
              loading={configurationsQuery.isLoading}
              page={page}
              rowKey={(pool) => pool.id}
              renderMobileItem={(pool) => (
                <Card className={styles.mobileCard} size="small" title={pool.name}>
                  <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                    <div className={styles.mobileMeta}>
                      <Tag color={statusColor(pool.status)}>{statusLabel(pool.status)}</Tag>
                      <Tag>{pool.customerCount} 位客户</Tag>
                      {pool.automaticReleaseEnabled ? <Tag color="blue">自动释放</Tag> : null}
                    </div>
                    <Typography.Text>
                      管理员：{pool.administratorActorIds.join("、") || "—"}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      成员资格：成员 {pool.eligibleActorIds.length} / 部门{" "}
                      {pool.eligibleDepartmentIds.length}
                    </Typography.Text>
                    <Space size={0}>
                      {renderEditAction(pool)}
                      {renderStatusAction(pool)}
                      {renderTransferAction(pool)}
                      {renderDeletePoolAction(pool)}
                    </Space>
                  </Space>
                </Card>
              )}
              onPageChange={setPage}
            />
          )}
          {statusMutation.isError ? (
            <Alert
              action={
                statusConflict !== null && requiresConflictRefresh(statusConflict) ? (
                  <Button size="small" type="primary" onClick={refreshAfterStatusConflict}>
                    刷新状态
                  </Button>
                ) : undefined
              }
              title={
                statusConflict?.title ??
                (statusMutation.error instanceof ApiError
                  ? statusMutation.error.message
                  : "客户公海状态暂时无法更新")
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
          {deletePoolMutation.isError ? (
            <Alert
              action={
                deletePoolConflict !== null && requiresConflictRefresh(deletePoolConflict) ? (
                  <Button size="small" type="primary" onClick={refreshAfterDeletePoolConflict}>
                    刷新状态
                  </Button>
                ) : undefined
              }
              title={
                deletePoolConflict?.title ??
                (deletePoolMutation.error instanceof ApiError
                  ? deletePoolMutation.error.message
                  : "客户公海暂时无法删除")
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
        </DataWorkspace>
        <Modal
          destroyOnHidden
          footer={
            <>
              <Button disabled={updateMutation.isPending} onClick={() => closeEdit()}>
                取消
              </Button>
              <Button
                disabled={!canSubmitEdit || editReviewRequired}
                loading={updateMutation.isPending}
                type="primary"
                onClick={submitEdit}
              >
                保存配置
              </Button>
            </>
          }
          open={editingPool !== null}
          title="编辑客户公海配置"
          onCancel={() => closeEdit()}
        >
          <Typography.Paragraph type="secondary">
            管理员、领取成员与部门范围只能从服务端可见目录中显式选择。新增管理员会同步加入领取成员范围；所有修改都携带当前版本，由服务端复核。
          </Typography.Paragraph>
          {editReviewRequired ? (
            <Alert
              title="服务端版本已变化。为避免覆盖其他成员的修改，请关闭后重新打开配置。"
              showIcon
              style={{ marginBottom: 12 }}
              type="warning"
            />
          ) : null}
          <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
            <label>
              <Typography.Text>公海名称</Typography.Text>
              <Input
                aria-label="编辑客户公海名称"
                disabled={editReviewRequired}
                maxLength={100}
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            </label>
            <label>
              <Typography.Text>每日领取上限</Typography.Text>
              <InputNumber
                aria-label="每日领取上限"
                disabled={editReviewRequired}
                max={10_000}
                min={0}
                style={{ width: "100%" }}
                value={editDailyClaimLimit}
                onChange={(value) => setEditDailyClaimLimit(value ?? 0)}
              />
            </label>
            <label>
              <Typography.Text>原负责人冷却天数</Typography.Text>
              <InputNumber
                aria-label="原负责人冷却天数"
                disabled={editReviewRequired}
                max={3650}
                min={0}
                style={{ width: "100%" }}
                value={editCooldownDays}
                onChange={(value) => setEditCooldownDays(value ?? 0)}
              />
            </label>
            <Space align="center">
              <Switch
                aria-label="启用自动释放"
                checked={editAutomaticReleaseEnabled}
                disabled={editReviewRequired}
                onChange={setEditAutomaticReleaseEnabled}
              />
              <Typography.Text>启用自动释放</Typography.Text>
            </Space>
            <section>
              <Typography.Text strong>管理员</Typography.Text>
              <Typography.Paragraph type="secondary">
                至少保留一名管理员。新增管理员会同时加入领取成员范围，但移除管理员不会自动移除其领取资格。
              </Typography.Paragraph>
              {canReadOrganization ? (
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Space wrap>
                    {editAdministratorActorIds.map((actorId) => (
                      <Space key={actorId} size={4}>
                        <Tag>{eligibleMemberNames.get(actorId) ?? `成员 ${actorId}`}</Tag>
                        <Button
                          aria-label={`移除管理员 ${actorId}`}
                          disabled={editReviewRequired || updateMutation.isPending}
                          size="small"
                          type="link"
                          onClick={() => removeEditAdministrator(actorId)}
                        >
                          移除
                        </Button>
                      </Space>
                    ))}
                  </Space>
                  <Typography.Text>从服务端可见成员中选择</Typography.Text>
                  {eligibilityMemberQuery.isError ? (
                    <Alert title="成员列表暂时无法加载" showIcon type="error" />
                  ) : (
                    <List
                      dataSource={[...(eligibilityMemberQuery.data ?? [])]}
                      loading={eligibilityMemberQuery.isLoading}
                      locale={{ emptyText: "未找到可选择成员" }}
                      renderItem={(member) => {
                        const selected = editAdministratorActorIds.includes(member.actorId);
                        const canAddToEligibility =
                          editEligibleActorIds.includes(member.actorId) ||
                          editEligibleActorIds.length < 500;
                        return (
                          <List.Item
                            actions={[
                              <Button
                                disabled={
                                  editReviewRequired ||
                                  selected ||
                                  editAdministratorActorIds.length >= 50 ||
                                  !canAddToEligibility
                                }
                                key={member.actorId}
                                size="small"
                                type="link"
                                onClick={() => addEditAdministrator(member)}
                              >
                                {selected ? "已是管理员" : "设为管理员"}
                              </Button>,
                            ]}
                          >
                            <List.Item.Meta
                              description={`成员 ${member.actorId}`}
                              title={member.displayName}
                            />
                          </List.Item>
                        );
                      }}
                    />
                  )}
                </Space>
              ) : (
                <Alert
                  title="当前没有组织目录读取权限，只能保留已有管理员范围。"
                  showIcon
                  type="warning"
                />
              )}
            </section>
            <section>
              <Typography.Text strong>领取资格</Typography.Text>
              <Typography.Paragraph type="secondary">
                公海至少需要一名领取成员或一个部门范围。
              </Typography.Paragraph>
              {canReadOrganization ? (
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>领取成员</Typography.Text>
                  <Input.Search
                    allowClear
                    disabled={editReviewRequired}
                    placeholder="按成员姓名搜索"
                    value={eligibilityMemberKeyword}
                    onChange={(event) => setEligibilityMemberKeyword(event.target.value)}
                  />
                  {eligibilityMemberQuery.isError ? (
                    <Alert title="成员列表暂时无法加载" showIcon type="error" />
                  ) : (
                    <List
                      dataSource={[...(eligibilityMemberQuery.data ?? [])]}
                      loading={eligibilityMemberQuery.isLoading}
                      locale={{ emptyText: "未找到可选择成员" }}
                      renderItem={(member) => {
                        const selected = editEligibleActorIds.includes(member.actorId);
                        return (
                          <List.Item
                            actions={[
                              <Button
                                disabled={
                                  editReviewRequired ||
                                  selected ||
                                  editEligibleActorIds.length >= 500
                                }
                                key={member.actorId}
                                size="small"
                                type="link"
                                onClick={() => addEligibleMember(member)}
                              >
                                {selected ? "已加入范围" : "添加领取成员"}
                              </Button>,
                            ]}
                          >
                            <List.Item.Meta
                              description={`成员 ${member.actorId}`}
                              title={member.displayName}
                            />
                          </List.Item>
                        );
                      }}
                    />
                  )}
                  <Space wrap>
                    {editEligibleActorIds.map((actorId) => (
                      <Tag
                        closable={!editReviewRequired && !updateMutation.isPending}
                        key={actorId}
                        onClose={() => removeEligibleMember(actorId)}
                      >
                        {eligibleMemberNames.get(actorId) ?? `成员 ${actorId}`}
                      </Tag>
                    ))}
                  </Space>
                  <Typography.Text>部门范围</Typography.Text>
                  {departmentQuery.isError ? (
                    <Alert title="部门列表暂时无法加载" showIcon type="error" />
                  ) : (
                    <List
                      dataSource={[...(departmentQuery.data ?? [])]}
                      loading={departmentQuery.isLoading}
                      locale={{ emptyText: "未找到可选择部门" }}
                      renderItem={(department) => {
                        const selected = editEligibleDepartmentIds.includes(
                          department.departmentId,
                        );
                        return (
                          <List.Item
                            actions={[
                              <Button
                                disabled={
                                  editReviewRequired ||
                                  selected ||
                                  editEligibleDepartmentIds.length >= 200
                                }
                                key={department.departmentId}
                                size="small"
                                type="link"
                                onClick={() => addEligibleDepartment(department)}
                              >
                                {selected ? "已加入范围" : "添加部门范围"}
                              </Button>,
                            ]}
                          >
                            <List.Item.Meta
                              description={`部门 ${department.departmentId}`}
                              title={department.name}
                            />
                          </List.Item>
                        );
                      }}
                    />
                  )}
                  <Space wrap>
                    {editEligibleDepartmentIds.map((departmentId) => (
                      <Tag
                        closable={!editReviewRequired && !updateMutation.isPending}
                        key={departmentId}
                        onClose={() => removeEligibleDepartment(departmentId)}
                      >
                        {eligibleDepartmentNames.get(departmentId) ?? `部门 ${departmentId}`}
                      </Tag>
                    ))}
                  </Space>
                </Space>
              ) : (
                <Alert
                  title="当前没有组织目录读取权限，只能保留已有领取资格范围。"
                  showIcon
                  type="warning"
                />
              )}
            </section>
            <section>
              <Typography.Text strong>自动释放规则</Typography.Text>
              <Typography.Paragraph type="secondary">
                启用自动释放时，至少保留一条规则。
              </Typography.Paragraph>
              <Space wrap>
                <Button
                  disabled={
                    editReviewRequired || editRules.some((rule) => rule.type === "STALE_UPDATE")
                  }
                  size="small"
                  onClick={() => addRule("STALE_UPDATE")}
                >
                  添加未更新规则
                </Button>
                <Button
                  disabled={editReviewRequired || editRules.some((rule) => rule.type === "NOT_WON")}
                  size="small"
                  onClick={() => addRule("NOT_WON")}
                >
                  添加未赢单规则
                </Button>
              </Space>
              <Space orientation="vertical" size="small" style={{ display: "flex", marginTop: 12 }}>
                {editRules.map((rule) => (
                  <Space key={rule.type} wrap>
                    <Tag>{ruleLabel(rule.type)}</Tag>
                    <InputNumber
                      aria-label={`${ruleLabel(rule.type)}自动释放天数`}
                      disabled={editReviewRequired}
                      max={3650}
                      min={1}
                      value={rule.inactiveDays}
                      onChange={(value) => updateRuleDays(rule.type, value ?? 0)}
                    />
                    <Typography.Text type="secondary">天</Typography.Text>
                    <Button
                      disabled={editReviewRequired}
                      size="small"
                      type="link"
                      onClick={() => removeRule(rule.type)}
                    >
                      移除规则
                    </Button>
                  </Space>
                ))}
              </Space>
            </section>
          </Space>
          {updateMutation.isError && updateConflict === null ? (
            <Alert
              title={
                updateMutation.error instanceof ApiError
                  ? updateMutation.error.message
                  : "客户公海配置暂时无法更新"
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
          {updateMutation.isError ? (
            <MutationConflictNotice
              error={updateMutation.error}
              onResolve={(resolution) => void resolveUpdateConflict(resolution)}
            />
          ) : null}
        </Modal>
        <Modal
          destroyOnHidden
          footer={
            <>
              <Button disabled={transferMutation.isPending} onClick={() => closeTransfer()}>
                取消
              </Button>
              <Button
                disabled={transferTargetPool === null}
                loading={transferMutation.isPending}
                type="primary"
                onClick={() => {
                  if (transferSourcePool === null || transferTargetPool === null) return;
                  transferMutation.mutate({
                    sourcePool: transferSourcePool,
                    targetPool: transferTargetPool,
                  });
                }}
              >
                确认转移
              </Button>
            </>
          }
          open={transferSourcePool !== null}
          title="转移客户公海"
          onCancel={() => closeTransfer()}
        >
          {transferSourcePool === null ? null : (
            <>
              <Typography.Paragraph type="secondary">
                将“{transferSourcePool.name}”当前的全部 {transferSourcePool.customerCount}{" "}
                位客户转移到选定的启用公海。该操作不删除来源公海，来源与目标状态均由服务端再次复核。
              </Typography.Paragraph>
              {transferTargetPool === null ? null : (
                <Alert
                  title={`已选择目标公海：${transferTargetPool.name}`}
                  showIcon
                  style={{ marginBottom: 12 }}
                  type="info"
                />
              )}
              {transferTargetsQuery.isError ? (
                <Alert title="目标公海列表暂时无法加载" showIcon type="error" />
              ) : (
                <>
                  <List
                    dataSource={transferTargetPageResult.items.filter(
                      (pool) => pool.id !== transferSourcePool.id && pool.status === "ACTIVE",
                    )}
                    loading={transferTargetsQuery.isLoading}
                    locale={{ emptyText: "本页没有可选的启用客户公海" }}
                    renderItem={(pool) => {
                      const selected = transferTargetPool?.id === pool.id;
                      return (
                        <List.Item
                          actions={[
                            <Button
                              key={pool.id}
                              size="small"
                              type="link"
                              onClick={() => setTransferTargetPool(pool)}
                            >
                              {selected ? "已选为目标" : "选择目标公海"}
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            description={`当前 ${pool.customerCount} 位客户`}
                            title={pool.name}
                          />
                        </List.Item>
                      );
                    }}
                  />
                  {transferTargetPageResult.total !== null &&
                  transferTargetPageResult.total > transferTargetPageResult.size ? (
                    <Pagination
                      current={transferTargetPageResult.page}
                      pageSize={transferTargetPageResult.size}
                      showSizeChanger={false}
                      size="small"
                      style={{ marginTop: 12 }}
                      total={transferTargetPageResult.total}
                      onChange={(nextPage) => setTransferTargetPage(nextPage)}
                    />
                  ) : null}
                </>
              )}
              {transferMutation.isError && transferConflict === null ? (
                <Alert
                  title={
                    transferMutation.error instanceof ApiError
                      ? transferMutation.error.message
                      : "客户公海暂时无法转移"
                  }
                  showIcon
                  style={{ marginTop: 12 }}
                  type="error"
                />
              ) : null}
              {transferMutation.isError ? (
                <MutationConflictNotice
                  error={transferMutation.error}
                  onResolve={(resolution) => void resolveTransferConflict(resolution)}
                />
              ) : null}
            </>
          )}
        </Modal>
        <Modal
          destroyOnHidden
          footer={
            <>
              <Button disabled={createMutation.isPending} onClick={closeCreate}>
                取消
              </Button>
              <Button
                disabled={!canReadOrganization || !canSubmitCreate}
                loading={createMutation.isPending}
                type="primary"
                onClick={() => createMutation.mutate()}
              >
                创建公海
              </Button>
            </>
          }
          open={createOpen}
          title="新建客户公海"
          onCancel={closeCreate}
        >
          <Typography.Paragraph type="secondary">
            首期创建仅提交名称与服务端可见管理员，并将所选管理员作为初始可领取成员；日领取上限不限、原负责人冷却为
            0
            天、自动释放关闭且无规则。部门范围、其他成员资格、自动释放和规则将在独立编辑流程中设置。
          </Typography.Paragraph>
          <Input
            aria-label="客户公海名称"
            maxLength={100}
            placeholder="输入客户公海名称"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
          />
          {canReadOrganization ? (
            <>
              <Typography.Title level={5}>管理员</Typography.Title>
              <Input.Search
                allowClear
                placeholder="按成员姓名搜索"
                value={administratorKeyword}
                onChange={(event) => setAdministratorKeyword(event.target.value)}
              />
              {administratorQuery.isError ? (
                <Alert
                  title="成员列表暂时无法加载"
                  showIcon
                  style={{ marginTop: 12 }}
                  type="error"
                />
              ) : (
                <List
                  dataSource={[...(administratorQuery.data ?? [])]}
                  loading={administratorQuery.isLoading}
                  locale={{ emptyText: "未找到可选择成员" }}
                  renderItem={(member) => {
                    const selected = administratorCandidates.some(
                      (candidate) => candidate.actorId === member.actorId,
                    );
                    return (
                      <List.Item
                        actions={[
                          <Button
                            disabled={selected || administratorCandidates.length >= 50}
                            key={member.actorId}
                            type="link"
                            onClick={() => addAdministrator(member)}
                          >
                            {selected ? "已选择" : "添加管理员"}
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          description={`成员 ${member.actorId}`}
                          title={member.displayName}
                        />
                      </List.Item>
                    );
                  }}
                />
              )}
              <div className={styles.mobileMeta} style={{ marginTop: 12 }}>
                {administratorCandidates.map((member) => (
                  <Tag
                    closable={!createMutation.isPending}
                    key={member.actorId}
                    onClose={() => removeAdministrator(member.actorId)}
                  >
                    {member.displayName}
                  </Tag>
                ))}
              </div>
            </>
          ) : (
            <Alert
              title="当前没有成员目录读取权限，无法选择客户公海管理员。"
              showIcon
              style={{ marginTop: 16 }}
              type="warning"
            />
          )}
          {createMutation.isError ? (
            <Alert
              title={
                createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : "客户公海暂时无法创建"
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
        </Modal>
      </main>
    </RouteAuthority>
  );
}
