import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Checkbox, DatePicker, Select, Skeleton, Space, Typography } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useState } from "react";

import type { components } from "~/api/generated/schema";
import type { ApiClient } from "~/api/client/api-client";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";

import { dashboardKeys } from "../model/query-keys";
import {
  dashboardModules,
  hasOrderedDashboardDateRange,
  withDashboardModuleVisibility,
} from "../model/dashboard-preference";

import styles from "./dashboard-preference-card.module.css";

type Preference = components["schemas"]["DashboardPreferenceResponse"];
type PreferenceUpdate = components["schemas"]["DashboardPreferenceUpdateRequest"];
type TimeRange = Preference["timeRange"];
type DataScope = Preference["dataScope"];

const timeRangeOptions: Array<{ label: string; value: TimeRange }> = [
  { label: "今天", value: "TODAY" },
  { label: "本周", value: "CURRENT_WEEK" },
  { label: "本月", value: "CURRENT_MONTH" },
  { label: "本季度", value: "CURRENT_QUARTER" },
  { label: "本年", value: "CURRENT_YEAR" },
  { label: "自定义日期", value: "CUSTOM" },
];

const dataScopeOptions: Array<{ label: string; value: DataScope }> = [
  { label: "仅自己", value: "SELF" },
  { label: "本部门", value: "DEPARTMENT" },
  { label: "本人及下属", value: "DEPARTMENT_SUBTREE" },
  { label: "全租户（受实际权限收窄）", value: "TENANT" },
];

function toRange(preference: Preference | null): [Dayjs, Dayjs] | null {
  if (
    preference?.timeRange !== "CUSTOM" ||
    !preference.customStartDate ||
    !preference.customEndDate
  ) {
    return null;
  }

  const start = dayjs(preference.customStartDate);
  const end = dayjs(preference.customEndDate);
  return start.isValid() && end.isValid() ? [start, end] : null;
}

/** Compact, versioned dashboard scope controls for the workbench toolbar. */
export function DashboardPreferenceToolbar() {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const identityKey = authState?.identityKey ?? "pending";
  return (
    <DashboardPreferenceCardContent
      apiClient={apiClient}
      embedded
      identityKey={identityKey}
      variant="toolbar"
      key={identityKey}
    />
  );
}

function DashboardPreferenceCardContent({
  apiClient,
  embedded,
  identityKey,
  variant,
}: Readonly<{
  apiClient: ApiClient | null;
  embedded: boolean;
  identityKey: string;
  variant: "card" | "toolbar";
}>) {
  const queryClient = useQueryClient();
  const [draftChanges, setDraftChanges] = useState<Partial<Preference> | null>(null);
  const preferenceQuery = useQuery({
    queryKey: dashboardKeys.preference(identityKey),
    queryFn: () =>
      apiClient?.getDashboardPreference() ??
      Promise.reject(new Error("Dashboard preference API is unavailable.")),
    enabled: apiClient !== null,
  });
  const draft = preferenceQuery.data ? { ...preferenceQuery.data, ...(draftChanges ?? {}) } : null;

  const updateMutation = useMutation({
    mutationFn: (request: PreferenceUpdate) =>
      apiClient?.updateDashboardPreference(request) ??
      Promise.reject(new Error("Dashboard preference API is unavailable.")),
    onSuccess: (preference) => {
      queryClient.setQueryData(dashboardKeys.preference(identityKey), preference);
      setDraftChanges(null);
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.overview(identityKey) });
    },
  });

  const range = toRange(draft);
  const customRangeValid =
    draft?.timeRange !== "CUSTOM" ||
    hasOrderedDashboardDateRange(draft.customStartDate, draft.customEndDate);
  const customRangeFeedback =
    draft?.timeRange === "CUSTOM" && !customRangeValid
      ? "请选择完整且有序的自定义日期范围。"
      : null;
  const canSave =
    draft !== null && draftChanges !== null && customRangeValid && !updateMutation.isPending;

  function updateTimeRange(timeRange: TimeRange) {
    setDraftChanges((current) => ({
      ...current,
      timeRange,
      ...(timeRange === "CUSTOM" ? {} : { customStartDate: undefined, customEndDate: undefined }),
    }));
  }

  function updateDateRange(nextRange: [Dayjs | null, Dayjs | null] | null) {
    setDraftChanges((current) => ({
      ...current,
      customStartDate: nextRange?.[0]?.format("YYYY-MM-DD"),
      customEndDate: nextRange?.[1]?.format("YYYY-MM-DD"),
    }));
  }

  function save() {
    if (!draft || !customRangeValid) return;
    void updateMutation.mutate({
      timeRange: draft.timeRange,
      dataScope: draft.dataScope,
      customStartDate: draft.timeRange === "CUSTOM" ? draft.customStartDate : undefined,
      customEndDate: draft.timeRange === "CUSTOM" ? draft.customEndDate : undefined,
      hiddenModules: draft.hiddenModules ?? [],
      version: draft.version ?? undefined,
    });
  }

  const controls = draft ? (
    <Space
      className={variant === "toolbar" ? styles.toolbar : undefined}
      orientation={variant === "toolbar" ? "horizontal" : "vertical"}
      size={variant === "toolbar" ? "small" : "middle"}
      wrap={variant === "toolbar"}
    >
      <Select
        aria-label="数据范围"
        className={variant === "toolbar" ? styles.toolbarSelect : undefined}
        options={dataScopeOptions}
        value={draft.dataScope}
        onChange={(dataScope: DataScope) =>
          setDraftChanges((current) => ({ ...current, dataScope }))
        }
      />
      <Select
        aria-label="时间范围"
        className={variant === "toolbar" ? styles.toolbarSelect : undefined}
        options={timeRangeOptions}
        value={draft.timeRange}
        onChange={updateTimeRange}
      />
      {draft.timeRange === "CUSTOM" ? (
        <>
          <DatePicker.RangePicker
            aria-label="自定义日期范围"
            aria-describedby="dashboard-custom-range-feedback"
            aria-invalid={customRangeFeedback !== null}
            value={range}
            onChange={updateDateRange}
          />
          <Typography.Text aria-live="polite" id="dashboard-custom-range-feedback" role="status">
            {customRangeFeedback ?? ""}
          </Typography.Text>
        </>
      ) : null}
      <Checkbox
        checked={!(draft.hiddenModules ?? []).includes(dashboardModules.customerContactReminder)}
        disabled={updateMutation.isPending}
        onChange={(event) =>
          setDraftChanges((current) => ({
            ...current,
            hiddenModules: withDashboardModuleVisibility(
              draft.hiddenModules,
              dashboardModules.customerContactReminder,
              event.target.checked,
            ),
          }))
        }
      >
        显示客户遗忘提醒
      </Checkbox>
      <Button disabled={!canSave} loading={updateMutation.isPending} type="primary" onClick={save}>
        {variant === "toolbar" ? "应用" : "保存偏好"}
      </Button>
    </Space>
  ) : preferenceQuery.isLoading ? (
    <Skeleton.Input active aria-label="正在加载仪表盘筛选" size="small" />
  ) : null;

  const content = (
    <>
      {variant === "card" ? (
        <Typography.Paragraph type="secondary">
          仅用于收窄当前成员可见数据，不能扩大任一业务对象的权限范围。
        </Typography.Paragraph>
      ) : null}
      {controls}
      {preferenceQuery.isError ? (
        <Alert
          className={variant === "toolbar" ? styles.toolbarFeedback : undefined}
          title={
            preferenceQuery.error instanceof ApiError
              ? preferenceQuery.error.message
              : "看板偏好暂时无法加载"
          }
          showIcon
          type="error"
        />
      ) : null}
      {updateMutation.isError ? (
        <Alert
          className={variant === "toolbar" ? styles.toolbarFeedback : undefined}
          title={
            updateMutation.error instanceof ApiError
              ? updateMutation.error.message
              : "保存看板偏好失败"
          }
          showIcon
          type="error"
        />
      ) : null}
    </>
  );

  return embedded ? content : <section aria-label="看板偏好">{content}</section>;
}
