import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TabsProps } from "antd";
import { useMemo, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict } from "~/api/errors/mutation-conflict";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { MutationConflictNotice } from "~/components/feedback/mutation-conflict-notice";

import { formatServerAmount } from "../model/format";
import {
  MAX_PERFORMANCE_TARGET_IMPORT_FILE_BYTES,
  isPerformanceTargetImportParseError,
  parsePerformanceTargetImportCsv,
  performanceTargetImportTemplate,
  type PerformanceTargetImportCommand,
  type PerformanceTargetImportScope,
} from "../model/performance-target-import";
import {
  performanceTargetRouteQueryFromSearchParams,
  withPerformanceTargetRouteQuery,
} from "../model/performance-target-route";
import { dashboardKeys } from "../model/query-keys";

type DepartmentPerformanceTarget = components["schemas"]["DepartmentPerformanceTargetResponse"];
type DepartmentTargetPeriod = DepartmentPerformanceTarget["period"];
type PerformanceTarget = components["schemas"]["PerformanceTargetResponse"];
type TargetScope = PerformanceTargetImportScope;

interface TargetFormValues {
  amount?: number;
}

interface TargetModalState {
  period: DepartmentTargetPeriod;
  periodNumber: number;
  scope: TargetScope;
  targetId: number | null;
}

interface DepartmentTargetPeriodRow {
  key: string;
  period: DepartmentTargetPeriod;
  periodNumber: number;
  target: DepartmentPerformanceTarget | null;
}

interface DepartmentBatchTargetRow extends DepartmentTargetPeriodRow {
  index: number;
}

interface DepartmentBatchModalState {
  departmentId: number;
  rows: DepartmentBatchTargetRow[];
  targetYear: number;
}

interface DepartmentBatchFormValues {
  amounts?: Array<number | null | undefined>;
}

interface MemberTargetMonthRow {
  month: number;
  target: PerformanceTarget | null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function isUsableAmount(value: number | undefined): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

function departmentPeriodLabel(period: DepartmentTargetPeriod, periodNumber: number): string {
  switch (period) {
    case "YEAR":
      return "年度";
    case "QUARTER":
      return `第 ${periodNumber} 季度`;
    case "MONTH":
      return `${periodNumber} 月`;
  }
}

function departmentPeriodRows(
  targets: readonly DepartmentPerformanceTarget[],
): DepartmentTargetPeriodRow[] {
  const byPeriod = new Map(
    targets.map((target) => [`${target.period}:${target.periodNumber}`, target]),
  );
  const periods: Array<Pick<DepartmentTargetPeriodRow, "period" | "periodNumber">> = [
    { period: "YEAR", periodNumber: 1 },
    ...Array.from({ length: 4 }, (_, index) => ({
      period: "QUARTER" as const,
      periodNumber: index + 1,
    })),
    ...Array.from({ length: 12 }, (_, index) => ({
      period: "MONTH" as const,
      periodNumber: index + 1,
    })),
  ];
  return periods.map(({ period, periodNumber }) => ({
    key: `${period}:${periodNumber}`,
    period,
    periodNumber,
    target: byPeriod.get(`${period}:${periodNumber}`) ?? null,
  }));
}

function memberTargetRows(targets: readonly PerformanceTarget[]): MemberTargetMonthRow[] {
  const byMonth = new Map(targets.map((target) => [target.targetMonth, target]));
  return Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    target: byMonth.get(index + 1) ?? null,
  }));
}

function targetScopeLabel(scope: TargetScope): string {
  return scope === "MEMBER" ? "成员目标" : "部门目标";
}

function downloadPerformanceTargetImportTemplate(scope: TargetScope): void {
  const file = new Blob([performanceTargetImportTemplate(scope)], {
    type: "text/csv;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.download =
    scope === "MEMBER"
      ? "member-performance-target-template.csv"
      : "department-performance-target-template.csv";
  anchor.href = objectUrl;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Configures the server-owned member and department contract targets. Department period values
 * are independent management settings; the browser never derives them from member targets.
 */
export function PerformanceTargetManagementPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [memberKeyword, setMemberKeyword] = useState("");
  const [modal, setModal] = useState<TargetModalState | null>(null);
  const [departmentBatchModal, setDepartmentBatchModal] =
    useState<DepartmentBatchModalState | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importInputKey, setImportInputKey] = useState(0);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importScope, setImportScope] = useState<TargetScope>("MEMBER");
  const [importValidationMessage, setImportValidationMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [form] = Form.useForm<TargetFormValues>();
  const [departmentBatchForm] = Form.useForm<DepartmentBatchFormValues>();
  const routeQuery = performanceTargetRouteQueryFromSearchParams(
    searchParams,
    new Date().getFullYear(),
  );
  const identityKey = authState?.identityKey ?? "pending";
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const memberId = routeQuery.memberId;
  const departmentId = routeQuery.departmentId;
  const targetScope = routeQuery.targetScope;
  const membersQuery = useQuery({
    queryKey: ["performance-target-member-options", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient?.getVisibleMembers({
        ...(memberKeyword.trim() === "" ? {} : { keyword: memberKeyword.trim() }),
        page: 1,
        size: 100,
      }) ?? Promise.reject(new Error("Member selection API is unavailable.")),
    enabled: apiClient !== null && canReadOrganization && targetScope === "MEMBER",
  });
  const departmentsQuery = useQuery({
    queryKey: ["performance-target-department-options", identityKey] as const,
    queryFn: () =>
      apiClient?.getOrganizationDepartments() ??
      Promise.reject(new Error("Department selection API is unavailable.")),
    enabled: apiClient !== null && canReadOrganization && targetScope === "DEPARTMENT",
  });
  const memberTargetsQuery = useQuery({
    queryKey: dashboardKeys.performanceTargets(identityKey, memberId ?? 0, routeQuery.targetYear),
    queryFn: () =>
      memberId === null || apiClient === null
        ? Promise.reject(new Error("Member performance target query is unavailable."))
        : apiClient.getPerformanceTargets({ memberId, targetYear: routeQuery.targetYear }),
    enabled: apiClient !== null && targetScope === "MEMBER" && memberId !== null,
  });
  const departmentTargetsQuery = useQuery({
    queryKey: dashboardKeys.departmentPerformanceTargets(
      identityKey,
      departmentId ?? 0,
      routeQuery.targetYear,
    ),
    queryFn: () =>
      departmentId === null || apiClient === null
        ? Promise.reject(new Error("Department performance target query is unavailable."))
        : apiClient.getDepartmentPerformanceTargets({
            departmentId,
            targetYear: routeQuery.targetYear,
          }),
    enabled: apiClient !== null && targetScope === "DEPARTMENT" && departmentId !== null,
  });
  const memberTargets = useMemo(
    () => memberTargetsQuery.data?.targets ?? [],
    [memberTargetsQuery.data],
  );
  const departmentTargets = useMemo(
    () => departmentTargetsQuery.data?.targets ?? [],
    [departmentTargetsQuery.data],
  );
  const memberRows = useMemo(() => memberTargetRows(memberTargets), [memberTargets]);
  const departmentRows = useMemo(
    () => departmentPeriodRows(departmentTargets),
    [departmentTargets],
  );
  const currentMemberTarget = useMemo(
    () =>
      modal?.scope === "MEMBER" && modal.targetId !== null
        ? (memberTargets.find((target) => target.id === modal.targetId) ?? null)
        : null,
    [memberTargets, modal],
  );
  const currentDepartmentTarget = useMemo(
    () =>
      modal?.scope === "DEPARTMENT" && modal.targetId !== null
        ? (departmentTargets.find((target) => target.id === modal.targetId) ?? null)
        : null,
    [departmentTargets, modal],
  );

  const refreshMemberTargets = () => {
    void queryClient.invalidateQueries({
      queryKey: dashboardKeys.performanceTargets(identityKey, memberId ?? 0, routeQuery.targetYear),
    });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.overview(identityKey) });
  };
  const refreshDepartmentTargets = () => {
    void queryClient.invalidateQueries({
      queryKey: dashboardKeys.departmentPerformanceTargets(
        identityKey,
        departmentId ?? 0,
        routeQuery.targetYear,
      ),
    });
  };
  const closeModal = () => {
    form.resetFields();
    setModal(null);
  };
  const createMemberMutation = useMutation({
    mutationFn: (amount: number) =>
      memberId === null || apiClient === null || modal?.scope !== "MEMBER"
        ? Promise.reject(new Error("Member performance target creation is unavailable."))
        : apiClient.createPerformanceTarget({
            amount,
            memberId,
            metric: "ACTIVE_CONTRACT",
            targetMonth: modal.periodNumber,
            targetYear: routeQuery.targetYear,
          }),
    onSuccess: () => {
      refreshMemberTargets();
      setFeedback("成员月度合同金额目标已保存。");
      closeModal();
    },
  });
  const updateMemberMutation = useMutation({
    mutationFn: (amount: number) =>
      apiClient === null || currentMemberTarget === null
        ? Promise.reject(new Error("Member performance target update is unavailable."))
        : apiClient.updatePerformanceTarget(currentMemberTarget.id, {
            amount,
            version: currentMemberTarget.version,
          }),
    onSuccess: () => {
      refreshMemberTargets();
      setFeedback("成员月度合同金额目标已更新。");
      closeModal();
    },
  });
  const deleteMemberMutation = useMutation({
    mutationFn: (target: PerformanceTarget) =>
      apiClient === null
        ? Promise.reject(new Error("Member performance target deletion is unavailable."))
        : apiClient.deletePerformanceTarget(target.id, target.version),
    onSuccess: () => {
      refreshMemberTargets();
      setFeedback("成员月度合同金额目标已删除。");
    },
  });
  const createDepartmentMutation = useMutation({
    mutationFn: (amount: number) =>
      departmentId === null || apiClient === null || modal?.scope !== "DEPARTMENT"
        ? Promise.reject(new Error("Department performance target creation is unavailable."))
        : apiClient.createDepartmentPerformanceTarget({
            amount,
            departmentId,
            metric: "ACTIVE_CONTRACT",
            period: modal.period,
            periodNumber: modal.periodNumber,
            targetYear: routeQuery.targetYear,
          }),
    onSuccess: () => {
      refreshDepartmentTargets();
      setFeedback("部门合同金额目标已保存。");
      closeModal();
    },
  });
  const updateDepartmentMutation = useMutation({
    mutationFn: (amount: number) =>
      apiClient === null || currentDepartmentTarget === null
        ? Promise.reject(new Error("Department performance target update is unavailable."))
        : apiClient.updateDepartmentPerformanceTarget(currentDepartmentTarget.id, {
            amount,
            version: currentDepartmentTarget.version,
          }),
    onSuccess: () => {
      refreshDepartmentTargets();
      setFeedback("部门合同金额目标已更新。");
      closeModal();
    },
  });
  const deleteDepartmentMutation = useMutation({
    mutationFn: (target: DepartmentPerformanceTarget) =>
      apiClient === null
        ? Promise.reject(new Error("Department performance target deletion is unavailable."))
        : apiClient.deleteDepartmentPerformanceTarget(target.id, target.version),
    onSuccess: () => {
      refreshDepartmentTargets();
      setFeedback("部门合同金额目标已删除。");
    },
  });
  const batchDepartmentMutation = useMutation({
    mutationFn: (
      request: components["schemas"]["DepartmentPerformanceTargetBatchUpsertRequest"],
    ) =>
      apiClient === null
        ? Promise.reject(new Error("Department performance target batch save is unavailable."))
        : apiClient.batchUpsertDepartmentPerformanceTargets(request),
    onSuccess: (_, request) => {
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.departmentPerformanceTargets(
          identityKey,
          request.departmentId,
          request.targetYear,
        ),
      });
      setFeedback("部门周期目标已批量保存。");
      closeDepartmentBatchModal();
    },
  });
  const importTargetsMutation = useMutation({
    mutationFn: (command: PerformanceTargetImportCommand) => {
      if (apiClient === null) {
        return Promise.reject(new Error("Performance target import API is unavailable."));
      }
      return command.scope === "MEMBER"
        ? apiClient.importPerformanceTargets(command.request)
        : apiClient.importDepartmentPerformanceTargets(command.request);
    },
    onSuccess: (response, command) => {
      const queryKey =
        command.scope === "MEMBER"
          ? (["dashboard", "performance-targets", identityKey] as const)
          : (["dashboard", "department-performance-targets", identityKey] as const);
      void queryClient.invalidateQueries({ queryKey });
      if (command.scope === "MEMBER") {
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.overview(identityKey) });
      }
      setFeedback(
        `${targetScopeLabel(command.scope)}已原子导入 ${response.importedCount} 条合同金额目标。`,
      );
      closeImportModal();
    },
  });

  function selectTargetScope(nextTargetScope: string) {
    if (nextTargetScope !== "MEMBER" && nextTargetScope !== "DEPARTMENT") return;
    setSearchParams(
      withPerformanceTargetRouteQuery(searchParams, {
        targetScope: nextTargetScope,
      }),
    );
  }

  function selectMember(nextMemberId: number | null) {
    setSearchParams(withPerformanceTargetRouteQuery(searchParams, { memberId: nextMemberId }));
  }

  function selectDepartment(nextDepartmentId: number | null) {
    setSearchParams(
      withPerformanceTargetRouteQuery(searchParams, { departmentId: nextDepartmentId }),
    );
  }

  function selectYear(nextYear: number | null) {
    if (nextYear === null || !Number.isInteger(nextYear)) return;
    setSearchParams(
      withPerformanceTargetRouteQuery(searchParams, {
        targetYear: Math.max(2000, Math.min(9999, nextYear)),
      }),
    );
  }

  function openMemberCreate(month: number) {
    createMemberMutation.reset();
    updateMemberMutation.reset();
    form.resetFields();
    setModal({ period: "MONTH", periodNumber: month, scope: "MEMBER", targetId: null });
  }

  function openMemberUpdate(target: PerformanceTarget) {
    createMemberMutation.reset();
    updateMemberMutation.reset();
    form.setFieldsValue({ amount: target.amount });
    setModal({
      period: "MONTH",
      periodNumber: target.targetMonth,
      scope: "MEMBER",
      targetId: target.id,
    });
  }

  function openDepartmentCreate(period: DepartmentTargetPeriod, periodNumber: number) {
    createDepartmentMutation.reset();
    updateDepartmentMutation.reset();
    form.resetFields();
    setModal({ period, periodNumber, scope: "DEPARTMENT", targetId: null });
  }

  function openDepartmentUpdate(target: DepartmentPerformanceTarget) {
    createDepartmentMutation.reset();
    updateDepartmentMutation.reset();
    form.setFieldsValue({ amount: target.amount });
    setModal({
      period: target.period,
      periodNumber: target.periodNumber,
      scope: "DEPARTMENT",
      targetId: target.id,
    });
  }

  function openDepartmentBatchModal() {
    if (departmentId === null) return;
    batchDepartmentMutation.reset();
    const rows = departmentRows.map((row, index) => ({ ...row, index }));
    departmentBatchForm.resetFields();
    departmentBatchForm.setFieldsValue({ amounts: rows.map((row) => row.target?.amount) });
    setDepartmentBatchModal({
      departmentId,
      rows,
      targetYear: routeQuery.targetYear,
    });
  }

  function closeDepartmentBatchModal() {
    departmentBatchForm.resetFields();
    setDepartmentBatchModal(null);
  }

  function openImportModal() {
    importTargetsMutation.reset();
    setImportFile(null);
    setImportInputKey((value) => value + 1);
    setImportScope(targetScope);
    setImportValidationMessage("");
    setImportModalOpen(true);
  }

  function closeImportModal() {
    setImportFile(null);
    setImportInputKey((value) => value + 1);
    setImportModalOpen(false);
    setImportValidationMessage("");
  }

  function selectImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    setImportValidationMessage("");
    if (file === null) {
      setImportFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setImportFile(null);
      setImportValidationMessage("请选择 .csv 格式的目标导入文件。");
      return;
    }
    if (file.size > MAX_PERFORMANCE_TARGET_IMPORT_FILE_BYTES) {
      setImportFile(null);
      setImportValidationMessage("CSV 文件不能超过 1 MB。");
      return;
    }
    setImportFile(file);
  }

  async function importTargetsFromCsv() {
    const file = importFile;
    const scope = importScope;
    if (file === null) {
      setImportValidationMessage("请先选择 CSV 文件。");
      return;
    }
    setImportValidationMessage("");
    try {
      const command = parsePerformanceTargetImportCsv(scope, await file.text());
      importTargetsMutation.mutate(command);
    } catch (error) {
      setImportValidationMessage(
        isPerformanceTargetImportParseError(error)
          ? error.message
          : "CSV 文件暂时无法解析，请检查后重试。",
      );
    }
  }

  function saveDepartmentBatch(values: DepartmentBatchFormValues) {
    if (departmentBatchModal === null) return;
    const targets: components["schemas"]["DepartmentPerformanceTargetBatchItemRequest"][] = [];
    for (const row of departmentBatchModal.rows) {
      const amount = values.amounts?.[row.index] ?? undefined;
      if (!isUsableAmount(amount)) continue;
      const target: components["schemas"]["DepartmentPerformanceTargetBatchItemRequest"] = {
        amount,
        period: row.period,
        periodNumber: row.periodNumber,
      };
      if (row.target !== null) target.version = row.target.version;
      targets.push(target);
    }
    if (targets.length === 0) {
      departmentBatchForm.setFields([
        { errors: ["请至少填写一个需保存的部门周期目标"], name: "amounts" },
      ]);
      return;
    }
    batchDepartmentMutation.mutate({
      departmentId: departmentBatchModal.departmentId,
      metric: "ACTIVE_CONTRACT",
      targetYear: departmentBatchModal.targetYear,
      targets,
    });
  }

  function resolveMemberConflict(
    mutation: { reset: () => void },
    resolution: "dismiss" | "keep-draft-and-reload" | "discard-draft-and-reload",
  ) {
    mutation.reset();
    if (resolution === "discard-draft-and-reload") closeModal();
    void memberTargetsQuery.refetch();
  }

  function resolveDepartmentConflict(
    mutation: { reset: () => void },
    resolution: "dismiss" | "keep-draft-and-reload" | "discard-draft-and-reload",
  ) {
    mutation.reset();
    if (resolution === "discard-draft-and-reload") closeModal();
    void departmentTargetsQuery.refetch();
  }

  function resolveDepartmentBatchConflict(
    resolution: "dismiss" | "keep-draft-and-reload" | "discard-draft-and-reload",
  ) {
    const batchState = departmentBatchModal;
    batchDepartmentMutation.reset();
    if (resolution === "discard-draft-and-reload") closeDepartmentBatchModal();
    if (batchState !== null) {
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.departmentPerformanceTargets(
          identityKey,
          batchState.departmentId,
          batchState.targetYear,
        ),
      });
    }
  }

  function resolveImportConflict(
    resolution: "dismiss" | "keep-draft-and-reload" | "discard-draft-and-reload",
  ) {
    const failedScope = importTargetsMutation.variables?.scope;
    importTargetsMutation.reset();
    if (resolution === "discard-draft-and-reload") closeImportModal();
    if (failedScope === "MEMBER") {
      void queryClient.invalidateQueries({
        queryKey: ["dashboard", "performance-targets", identityKey],
      });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.overview(identityKey) });
    } else if (failedScope === "DEPARTMENT") {
      void queryClient.invalidateQueries({
        queryKey: ["dashboard", "department-performance-targets", identityKey],
      });
    }
  }

  const memberColumns: ColumnsType<MemberTargetMonthRow> = [
    { dataIndex: "month", key: "month", title: "月份", render: (month) => `${month} 月` },
    { key: "metric", title: "考核指标", render: () => "合同金额" },
    {
      key: "amount",
      title: "目标金额",
      render: (_, row) => (row.target === null ? "未设置" : formatServerAmount(row.target.amount)),
    },
    {
      key: "actions",
      title: "操作",
      render: (_, row) => (
        <ActionAuthority authority={authority.dashboardTargetsWrite}>
          {row.target === null ? (
            <Button onClick={() => openMemberCreate(row.month)} size="small" type="link">
              设置目标
            </Button>
          ) : (
            <Space size="small">
              <Button onClick={() => openMemberUpdate(row.target!)} size="small" type="link">
                编辑
              </Button>
              <Popconfirm
                cancelText="取消"
                description="删除后该月目标不会再计入个人工作台；服务端会再次确认版本。"
                okButtonProps={{ danger: true }}
                okText="确认删除"
                onConfirm={() => deleteMemberMutation.mutate(row.target!)}
                title={`删除 ${row.month} 月合同金额目标？`}
              >
                <Button
                  danger
                  loading={
                    deleteMemberMutation.isPending &&
                    deleteMemberMutation.variables?.id === row.target.id
                  }
                  size="small"
                  type="link"
                >
                  删除
                </Button>
              </Popconfirm>
            </Space>
          )}
        </ActionAuthority>
      ),
    },
  ];
  const departmentColumns: ColumnsType<DepartmentTargetPeriodRow> = [
    {
      key: "period",
      title: "目标周期",
      render: (_, row) => departmentPeriodLabel(row.period, row.periodNumber),
    },
    { key: "metric", title: "考核指标", render: () => "合同金额" },
    {
      key: "amount",
      title: "目标金额",
      render: (_, row) => (row.target === null ? "未设置" : formatServerAmount(row.target.amount)),
    },
    {
      key: "actions",
      title: "操作",
      render: (_, row) => (
        <ActionAuthority authority={authority.dashboardTargetsWrite}>
          {row.target === null ? (
            <Button
              onClick={() => openDepartmentCreate(row.period, row.periodNumber)}
              size="small"
              type="link"
            >
              设置目标
            </Button>
          ) : (
            <Space size="small">
              <Button onClick={() => openDepartmentUpdate(row.target!)} size="small" type="link">
                编辑
              </Button>
              <Popconfirm
                cancelText="取消"
                description="删除后该部门周期目标不再保留；服务端会再次确认版本和部门仍处于活动状态。"
                okButtonProps={{ danger: true }}
                okText="确认删除"
                onConfirm={() => deleteDepartmentMutation.mutate(row.target!)}
                title={`删除${departmentPeriodLabel(row.period, row.periodNumber)}合同金额目标？`}
              >
                <Button
                  danger
                  loading={
                    deleteDepartmentMutation.isPending &&
                    deleteDepartmentMutation.variables?.id === row.target.id
                  }
                  size="small"
                  type="link"
                >
                  删除
                </Button>
              </Popconfirm>
            </Space>
          )}
        </ActionAuthority>
      ),
    },
  ];
  const departmentBatchColumns: ColumnsType<DepartmentBatchTargetRow> = [
    {
      key: "period",
      title: "目标周期",
      render: (_, row) => departmentPeriodLabel(row.period, row.periodNumber),
    },
    { key: "metric", title: "考核指标", render: () => "合同金额" },
    {
      key: "amount",
      title: "目标金额（元）",
      render: (_, row) => (
        <Form.Item
          name={["amounts", row.index]}
          rules={[
            {
              validator: async (_, value: unknown) =>
                value === null || value === undefined
                  ? undefined
                  : isUsableAmount(typeof value === "number" ? value : undefined)
                    ? undefined
                    : Promise.reject(new Error("请输入大于 0 且可精确保存的金额")),
            },
          ]}
          style={{ marginBottom: 0 }}
        >
          <InputNumber
            addonAfter="元"
            aria-label={`${departmentPeriodLabel(row.period, row.periodNumber)}目标金额（元）`}
            inputMode="decimal"
            max={Number.MAX_SAFE_INTEGER}
            min={0.01}
            precision={2}
            style={{ width: "100%" }}
          />
        </Form.Item>
      ),
    },
  ];
  const mutationErrors = [
    createMemberMutation.error,
    updateMemberMutation.error,
    deleteMemberMutation.error,
    createDepartmentMutation.error,
    updateDepartmentMutation.error,
    deleteDepartmentMutation.error,
    batchDepartmentMutation.error,
    importTargetsMutation.error,
  ].filter((error) => error !== null && getMutationConflict(error) === null);
  const tabItems: TabsProps["items"] = [
    {
      children: (
        <Space align="end" wrap>
          <div>
            <Typography.Text>
              <label htmlFor="performance-target-member">成员</label>
            </Typography.Text>
            {canReadOrganization ? (
              <Select
                aria-label="成员"
                allowClear
                id="performance-target-member"
                loading={membersQuery.isLoading}
                notFoundContent={membersQuery.isLoading ? <Spin size="small" /> : "未找到可见成员"}
                onChange={(value: number | undefined) => selectMember(value ?? null)}
                onSearch={setMemberKeyword}
                options={(membersQuery.data ?? []).map((member) => ({
                  label: `${member.displayName}（${member.actorId}）`,
                  value: member.actorId,
                }))}
                placeholder="搜索并选择成员"
                showSearch
                style={{ minWidth: 260 }}
                value={memberId ?? undefined}
                filterOption={false}
              />
            ) : (
              <InputNumber
                aria-label="成员"
                id="performance-target-member"
                min={1}
                onChange={(value) => selectMember(typeof value === "number" ? value : null)}
                placeholder="输入成员 ID"
                precision={0}
                style={{ width: 220 }}
                value={memberId ?? undefined}
              />
            )}
          </div>
          <div>
            <Typography.Text>
              <label htmlFor="performance-target-member-year">年度</label>
            </Typography.Text>
            <InputNumber
              aria-label="年度"
              id="performance-target-member-year"
              max={9999}
              min={2000}
              onChange={selectYear}
              precision={0}
              style={{ display: "block", width: 140 }}
              value={routeQuery.targetYear}
            />
          </div>
        </Space>
      ),
      key: "MEMBER",
      label: "成员目标",
    },
    {
      children: (
        <Space align="end" wrap>
          <div>
            <Typography.Text>
              <label htmlFor="performance-target-department">部门</label>
            </Typography.Text>
            {canReadOrganization ? (
              <Select
                aria-label="部门"
                allowClear
                id="performance-target-department"
                loading={departmentsQuery.isLoading}
                notFoundContent={
                  departmentsQuery.isLoading ? <Spin size="small" /> : "未找到可见活动部门"
                }
                onChange={(value: number | undefined) => selectDepartment(value ?? null)}
                options={(departmentsQuery.data ?? [])
                  .filter((department) => department.active)
                  .map((department) => ({ label: department.name, value: department.id }))}
                placeholder="选择部门"
                showSearch
                style={{ minWidth: 260 }}
                value={departmentId ?? undefined}
              />
            ) : (
              <InputNumber
                aria-label="部门"
                id="performance-target-department"
                min={1}
                onChange={(value) => selectDepartment(typeof value === "number" ? value : null)}
                placeholder="输入部门 ID"
                precision={0}
                style={{ width: 220 }}
                value={departmentId ?? undefined}
              />
            )}
          </div>
          <div>
            <Typography.Text>
              <label htmlFor="performance-target-department-year">年度</label>
            </Typography.Text>
            <InputNumber
              aria-label="年度"
              id="performance-target-department-year"
              max={9999}
              min={2000}
              onChange={selectYear}
              precision={0}
              style={{ display: "block", width: 140 }}
              value={routeQuery.targetYear}
            />
          </div>
        </Space>
      ),
      key: "DEPARTMENT",
      label: "部门目标",
    },
  ];
  const isDepartmentModal = modal?.scope === "DEPARTMENT";
  const modalTitle =
    modal === null ? "" : `${departmentPeriodLabel(modal.period, modal.periodNumber)}合同金额目标`;
  const modalPending =
    createMemberMutation.isPending ||
    updateMemberMutation.isPending ||
    createDepartmentMutation.isPending ||
    updateDepartmentMutation.isPending;

  return (
    <RouteAuthority authority={authority.dashboardTargetsRead}>
      <main>
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <div>
            <Typography.Title level={1}>业绩目标</Typography.Title>
            <Typography.Text type="secondary">
              管理成员月度与部门年度、季度、月度合同金额目标。所有目标、主体有效性与版本由服务端校验；部门周期目标不会由成员目标汇总生成。
            </Typography.Text>
          </div>
          <Card
            extra={
              <ActionAuthority authority={authority.dashboardTargetsWrite}>
                <Button onClick={openImportModal}>导入 CSV</Button>
              </ActionAuthority>
            }
            title="目标类型和查询范围"
          >
            <Tabs activeKey={targetScope} items={tabItems} onChange={selectTargetScope} />
            {!canReadOrganization ? (
              <Alert
                description={
                  targetScope === "MEMBER"
                    ? "当前账号没有成员目录读取权限。可输入服务端已知的成员 ID，提交前仍会由服务端确认成员范围和有效状态。"
                    : "当前账号没有部门目录读取权限。可输入服务端已知的部门 ID，查询或写入前仍会由服务端确认部门属于当前租户且处于活动状态。"
                }
                showIcon
                style={{ marginTop: 16 }}
                type="info"
              />
            ) : null}
            {targetScope === "MEMBER" && membersQuery.isError ? (
              <Alert
                title={errorMessage(membersQuery.error, "成员选择暂时无法加载")}
                showIcon
                style={{ marginTop: 16 }}
                type="error"
              />
            ) : null}
            {targetScope === "DEPARTMENT" && departmentsQuery.isError ? (
              <Alert
                title={errorMessage(departmentsQuery.error, "部门选择暂时无法加载")}
                showIcon
                style={{ marginTop: 16 }}
                type="error"
              />
            ) : null}
            <Typography.Text aria-live="polite" role="status">
              {targetScope === "MEMBER"
                ? memberId === null
                  ? "尚未选择成员。"
                  : `正在查看成员 ${memberId} 在 ${routeQuery.targetYear} 年的月度合同金额目标。`
                : departmentId === null
                  ? "尚未选择部门。"
                  : `正在查看部门 ${departmentId} 在 ${routeQuery.targetYear} 年的年度、季度和月度合同金额目标。`}
            </Typography.Text>
          </Card>
          <Typography.Text aria-live="polite" role="status">
            {feedback}
          </Typography.Text>
          {targetScope === "MEMBER" && memberTargetsQuery.isError ? (
            <Alert
              title={errorMessage(memberTargetsQuery.error, "成员业绩目标暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          {targetScope === "DEPARTMENT" && departmentTargetsQuery.isError ? (
            <Alert
              title={errorMessage(departmentTargetsQuery.error, "部门业绩目标暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          {mutationErrors.map((error, index) => (
            <Alert
              key={index}
              title={errorMessage(error, "业绩目标操作暂时无法完成")}
              showIcon
              type="error"
            />
          ))}
          <MutationConflictNotice
            error={createMemberMutation.error}
            onResolve={(resolution) => resolveMemberConflict(createMemberMutation, resolution)}
          />
          <MutationConflictNotice
            error={updateMemberMutation.error}
            onResolve={(resolution) => resolveMemberConflict(updateMemberMutation, resolution)}
          />
          <MutationConflictNotice
            error={deleteMemberMutation.error}
            onResolve={(resolution) => resolveMemberConflict(deleteMemberMutation, resolution)}
          />
          <MutationConflictNotice
            error={createDepartmentMutation.error}
            onResolve={(resolution) =>
              resolveDepartmentConflict(createDepartmentMutation, resolution)
            }
          />
          <MutationConflictNotice
            error={updateDepartmentMutation.error}
            onResolve={(resolution) =>
              resolveDepartmentConflict(updateDepartmentMutation, resolution)
            }
          />
          <MutationConflictNotice
            error={deleteDepartmentMutation.error}
            onResolve={(resolution) =>
              resolveDepartmentConflict(deleteDepartmentMutation, resolution)
            }
          />
          <MutationConflictNotice
            error={batchDepartmentMutation.error}
            onResolve={resolveDepartmentBatchConflict}
          />
          <MutationConflictNotice
            error={importTargetsMutation.error}
            onResolve={resolveImportConflict}
          />
          {targetScope === "MEMBER" ? (
            <Card title={`${routeQuery.targetYear} 年成员月度目标`}>
              {memberId === null ? (
                <Typography.Text type="secondary">
                  选择成员后可查看和设置其月度目标。
                </Typography.Text>
              ) : (
                <Table
                  columns={memberColumns}
                  dataSource={memberRows}
                  loading={memberTargetsQuery.isLoading}
                  pagination={false}
                  rowKey="month"
                  size="middle"
                />
              )}
            </Card>
          ) : (
            <Card
              extra={
                <ActionAuthority authority={authority.dashboardTargetsWrite}>
                  <Button
                    disabled={
                      departmentId === null ||
                      departmentTargetsQuery.isFetching ||
                      departmentTargetsQuery.isError
                    }
                    onClick={openDepartmentBatchModal}
                  >
                    批量设置
                  </Button>
                </ActionAuthority>
              }
              title={`${routeQuery.targetYear} 年部门目标`}
            >
              <Typography.Paragraph type="secondary">
                年度、季度和月度金额为分别维护的服务端配置值，不会自动相加、拆分或作为部门完成金额展示。
              </Typography.Paragraph>
              {departmentId === null ? (
                <Typography.Text type="secondary">
                  选择部门后可查看和设置其年度、季度与月度目标。
                </Typography.Text>
              ) : (
                <Table
                  columns={departmentColumns}
                  dataSource={departmentRows}
                  loading={departmentTargetsQuery.isLoading}
                  pagination={false}
                  rowKey="key"
                  size="middle"
                />
              )}
            </Card>
          )}
        </Space>
      </main>
      <Modal
        confirmLoading={modalPending}
        onCancel={closeModal}
        onOk={() => form.submit()}
        open={modal !== null}
        title={modalTitle}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={({ amount }) => {
            if (!isUsableAmount(amount) || modal === null) return;
            if (modal.scope === "MEMBER") {
              if (currentMemberTarget === null) createMemberMutation.mutate(amount);
              else updateMemberMutation.mutate(amount);
            } else if (currentDepartmentTarget === null) {
              createDepartmentMutation.mutate(amount);
            } else {
              updateDepartmentMutation.mutate(amount);
            }
          }}
        >
          <Form.Item
            label="目标金额"
            name="amount"
            rules={[
              { required: true, message: "请输入目标金额" },
              {
                validator: async (_, value: unknown) =>
                  isUsableAmount(typeof value === "number" ? value : undefined)
                    ? undefined
                    : Promise.reject(new Error("请输入大于 0 且可精确保存的金额")),
              },
            ]}
          >
            <InputNumber
              addonAfter="元"
              aria-label="目标金额（元）"
              inputMode="decimal"
              max={Number.MAX_SAFE_INTEGER}
              min={0.01}
              precision={2}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Typography.Text type="secondary">
            {isDepartmentModal
              ? "部门周期目标会按服务端规则独立保存，不会自动换算为其他周期或完成金额。"
              : "金额会按服务端规则保存为两位小数；浏览器仅接受可安全精确传输的数值。"}
          </Typography.Text>
        </Form>
      </Modal>
      <Modal
        confirmLoading={batchDepartmentMutation.isPending}
        onCancel={closeDepartmentBatchModal}
        onOk={() => departmentBatchForm.submit()}
        open={departmentBatchModal !== null}
        title={
          departmentBatchModal === null
            ? ""
            : `批量设置 ${departmentBatchModal.targetYear} 年部门合同金额目标`
        }
        width={760}
      >
        <Typography.Paragraph type="secondary">
          已填写的周期会携带打开时取得的服务端版本并一次性保存；任一周期发生版本冲突，整批不会部分生效。清空输入不会删除既有目标，如需删除请使用列表中的删除操作。
        </Typography.Paragraph>
        <Form form={departmentBatchForm} layout="vertical" onFinish={saveDepartmentBatch}>
          <Table
            columns={departmentBatchColumns}
            dataSource={departmentBatchModal?.rows ?? []}
            pagination={false}
            rowKey="key"
            size="small"
          />
        </Form>
      </Modal>
      <Modal
        cancelText="取消"
        confirmLoading={importTargetsMutation.isPending}
        okText="开始导入"
        onCancel={closeImportModal}
        onOk={() => void importTargetsFromCsv()}
        open={importModalOpen}
        title="导入业绩目标 CSV"
      >
        <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
          <div>
            <Typography.Text>
              <label htmlFor="performance-target-import-scope">目标对象</label>
            </Typography.Text>
            <Select
              aria-label="目标对象"
              id="performance-target-import-scope"
              onChange={(value: TargetScope) => {
                setImportFile(null);
                setImportInputKey((current) => current + 1);
                setImportScope(value);
                setImportValidationMessage("");
              }}
              options={[
                { label: "成员目标", value: "MEMBER" },
                { label: "部门目标", value: "DEPARTMENT" },
              ]}
              style={{ display: "block", marginTop: 8, width: 220 }}
              value={importScope}
            />
          </div>
          <div>
            <Typography.Text>
              <label htmlFor="performance-target-import-file">CSV 文件</label>
            </Typography.Text>
            <input
              accept=".csv,text/csv"
              aria-describedby="performance-target-import-file-help"
              id="performance-target-import-file"
              key={importInputKey}
              onChange={selectImportFile}
              style={{ display: "block", marginTop: 8 }}
              type="file"
            />
            <Typography.Paragraph id="performance-target-import-file-help" type="secondary">
              仅接受不超过 1 MB 的 UTF-8 CSV，最多 200
              行。文件会在浏览器内解析为固定的类型化目标行；原始文件、文件名和文件内容均不会上传或保存。
            </Typography.Paragraph>
            <Button
              onClick={() => downloadPerformanceTargetImportTemplate(importScope)}
              type="link"
            >
              下载 {targetScopeLabel(importScope)} CSV 模板
            </Button>
          </div>
          <Typography.Text type={importFile === null ? "secondary" : undefined}>
            {importFile === null ? "尚未选择文件。" : `已选择：${importFile.name}`}
          </Typography.Text>
          <Typography.Paragraph type="secondary">
            {importScope === "MEMBER"
              ? "成员模板表头：memberId,targetYear,targetMonth,amount"
              : "部门模板表头：departmentId,targetYear,period,periodNumber,amount"}
          </Typography.Paragraph>
          {importValidationMessage === "" ? null : (
            <Alert title={importValidationMessage} showIcon type="error" />
          )}
        </Space>
      </Modal>
    </RouteAuthority>
  );
}
