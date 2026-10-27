import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";

import {
  toWorkTaskSeriesUpdateRequest,
  type WorkTaskSeriesUpdateValues,
} from "../model/work-task-series-form";
import { workTaskSeriesKeys } from "../model/series-query-keys";
import { type WorkTaskSeriesPriority } from "../model/work-task-series-detail";
import {
  workTaskSeriesWeekdays,
  type WorkTaskSeriesFrequency,
  type WorkTaskSeriesWeekday,
} from "../model/work-task-series-list-item";

import styles from "./work-task-series-create-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

type MonthlyDateKind = "DAY" | "LAST_DAY";

interface WorkTaskSeriesEditFormValues {
  title?: string;
  description?: string;
  priority?: WorkTaskSeriesPriority;
  assigneeActorId?: number;
  followerActorIds?: number[];
  frequency?: WorkTaskSeriesFrequency;
  interval?: number;
  weekdays?: WorkTaskSeriesWeekday[];
  monthlyDateKind?: MonthlyDateKind;
  monthDay?: number;
  zoneId?: string;
  startLocalDate?: string;
  localTime?: string;
  endLocalDate?: string;
}

const frequencyOptions: Array<{ label: string; value: WorkTaskSeriesFrequency }> = [
  { label: "每天", value: "DAILY" },
  { label: "每周", value: "WEEKLY" },
  { label: "每月", value: "MONTHLY" },
];

const priorityOptions: Array<{ label: string; value: WorkTaskSeriesPriority }> = [
  { label: "低", value: "LOW" },
  { label: "普通", value: "NORMAL" },
  { label: "高", value: "HIGH" },
  { label: "紧急", value: "URGENT" },
];

const weekdayLabels: Readonly<Record<WorkTaskSeriesWeekday, string>> = {
  FRIDAY: "周五",
  MONDAY: "周一",
  SATURDAY: "周六",
  SUNDAY: "周日",
  THURSDAY: "周四",
  TUESDAY: "周二",
  WEDNESDAY: "周三",
};

function validZoneId(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function WorkTaskSeriesEditPage() {
  const { seriesId: seriesIdParam } = useParams();
  const seriesId = parseRouteId(seriesIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<WorkTaskSeriesEditFormValues>();
  const [memberKeyword, setMemberKeyword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadWorkTasks = hasAuthority(authorization, authority.workTasksRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const frequency = Form.useWatch("frequency", form);
  const monthlyDateKind = Form.useWatch("monthlyDateKind", form);
  const baselineQuery = useQuery({
    queryKey: workTaskSeriesKeys.detail(identityKey, seriesId ?? 0),
    queryFn: () =>
      apiClient === null || seriesId === null
        ? Promise.reject(new Error("周期任务编辑基线暂时不可用。"))
        : apiClient.getWorkTaskSeriesDetail(seriesId),
    enabled: apiClient !== null && seriesId !== null && canReadWorkTasks,
  });
  const baseline = baselineQuery.data;
  const canUpdate = baseline?.allowedActions.includes("UPDATE") === true;
  const memberQuery = useQuery({
    queryKey: ["member-selector", "work-task-series-edit", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("成员选择暂时不可用。"))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: memberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && canReadOrganization && canUpdate,
  });
  const updateMutation = useMutation({
    mutationFn: (values: WorkTaskSeriesUpdateValues) => {
      const request = toWorkTaskSeriesUpdateRequest(values);
      return apiClient === null || seriesId === null || request === null
        ? Promise.reject(new Error("周期任务更新数据暂时不可用。"))
        : apiClient.updateWorkTaskSeries(seriesId, request);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: workTaskSeriesKeys.lists(identityKey) });
      queryClient.removeQueries({ queryKey: workTaskSeriesKeys.detail(identityKey, result.id) });
      navigate("/work/task-series", { replace: true });
    },
  });
  const memberOptions = useMemo(() => {
    if (baseline === undefined) return [];
    const options = new Map(
      (memberQuery.data ?? []).map((member) => [member.actorId, member.displayName]),
    );
    for (const actorId of [baseline.assigneeActorId, ...baseline.followerActorIds]) {
      if (!options.has(actorId)) options.set(actorId, `成员 #${actorId}`);
    }
    return [...options].map(([value, label]) => ({ label, value }));
  }, [baseline, memberQuery.data]);

  function submit(values: WorkTaskSeriesEditFormValues) {
    if (
      baseline === undefined ||
      values.title === undefined ||
      values.description === undefined ||
      values.priority === undefined ||
      values.assigneeActorId === undefined ||
      values.frequency === undefined ||
      values.interval === undefined ||
      values.zoneId === undefined ||
      values.startLocalDate === undefined ||
      values.localTime === undefined
    ) {
      return;
    }
    const requestValues: WorkTaskSeriesUpdateValues = {
      assigneeActorId: values.assigneeActorId,
      description: values.description,
      ...(values.endLocalDate === undefined ? {} : { endLocalDate: values.endLocalDate }),
      followerActorIds: values.followerActorIds ?? [],
      frequency: values.frequency,
      interval: values.interval,
      lastDayOfMonth: values.frequency === "MONTHLY" && values.monthlyDateKind === "LAST_DAY",
      localTime: values.localTime,
      ...(values.frequency === "MONTHLY" && values.monthlyDateKind === "DAY"
        ? { monthDay: values.monthDay }
        : {}),
      priority: values.priority,
      startLocalDate: values.startLocalDate,
      title: values.title,
      version: baseline.version,
      weekdays: values.frequency === "WEEKLY" ? (values.weekdays ?? []) : [],
      zoneId: values.zoneId,
    };
    if (toWorkTaskSeriesUpdateRequest(requestValues) === null) {
      setFormError("周期规则、成员或版本基线无效，请重新加载后再试。");
      return;
    }
    setFormError(null);
    updateMutation.mutate(requestValues);
  }

  function changeFrequency(nextFrequency: WorkTaskSeriesFrequency) {
    form.setFieldsValue({
      frequency: nextFrequency,
      monthDay: undefined,
      monthlyDateKind: "DAY",
      weekdays: [],
    });
    setFormError(null);
  }

  if (seriesId === null) return <StatusPage kind="not-found" />;
  if (baselineQuery.isLoading) {
    return (
      <div
        aria-label="正在加载周期任务编辑基线"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }
  if (baselineQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(baselineQuery.error)}
        onRetry={() => void baselineQuery.refetch()}
      />
    );
  }
  if (baseline === undefined || baseline.id !== seriesId) return <StatusPage kind="unavailable" />;
  if (!canUpdate) return <StatusPage kind="forbidden" />;

  const intervalMaximum = frequency === "DAILY" ? 365 : frequency === "MONTHLY" ? 24 : 52;

  return (
    <RouteAuthority authority={authority.workTasksRead}>
      <main className={styles.page}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/work/task-series")}>
          返回周期任务
        </Button>
        <section>
          <Typography.Title level={2}>编辑周期任务</Typography.Title>
          <Typography.Text type="secondary">
            仅在当前系列的服务端 allowedActions 包含 UPDATE
            时读取完整、版本化基线。成员候选仅从服务端可见目录加载；保存完整回写标题、描述、优先级、处理人、关注人和日历规则，服务端仍复核资格、下次发生与并发。
          </Typography.Text>
        </section>
        {formError !== null ? <Alert title={formError} showIcon type="warning" /> : null}
        {updateMutation.isError ? (
          <Alert
            title={
              updateMutation.error instanceof ApiError
                ? updateMutation.error.message
                : "周期任务暂时无法更新"
            }
            showIcon
            type="error"
          />
        ) : null}
        {memberQuery.isError ? (
          <Alert
            title="成员目录暂时无法加载；可保留服务端回显的处理人和关注人保存其他字段。"
            showIcon
            type="warning"
          />
        ) : null}
        <Card title="周期任务结构" extra={<Tag>{baseline.status}</Tag>}>
          <Form
            form={form}
            initialValues={{
              assigneeActorId: baseline.assigneeActorId,
              description: baseline.description,
              endLocalDate: baseline.endLocalDate ?? undefined,
              followerActorIds: [...baseline.followerActorIds],
              frequency: baseline.frequency,
              interval: baseline.interval,
              localTime: baseline.localTime.slice(0, 5),
              monthDay: baseline.monthDay ?? undefined,
              monthlyDateKind: baseline.lastDayOfMonth ? "LAST_DAY" : "DAY",
              priority: baseline.priority,
              startLocalDate: baseline.startLocalDate,
              title: baseline.title,
              weekdays: [...baseline.weekdays],
              zoneId: baseline.zoneId,
            }}
            layout="vertical"
            onFinish={submit}
          >
            <Form.Item
              label="周期任务标题"
              name="title"
              rules={[{ required: true, whitespace: true, message: "请输入周期任务标题" }]}
            >
              <Input aria-label="周期任务标题" disabled={updateMutation.isPending} />
            </Form.Item>
            <Form.Item label="任务描述" name="description">
              <Input.TextArea aria-label="任务描述" disabled={updateMutation.isPending} rows={4} />
            </Form.Item>
            <Form.Item
              label="优先级"
              name="priority"
              rules={[{ required: true, message: "请选择优先级" }]}
            >
              <Select
                aria-label="优先级"
                disabled={updateMutation.isPending}
                options={priorityOptions}
              />
            </Form.Item>
            <Form.Item
              label="处理人"
              name="assigneeActorId"
              rules={[{ required: true, message: "请选择处理人" }]}
            >
              <Select
                aria-label="处理人"
                disabled={updateMutation.isPending || !canReadOrganization}
                filterOption={false}
                loading={memberQuery.isLoading}
                options={memberOptions}
                showSearch
                onSearch={setMemberKeyword}
              />
            </Form.Item>
            <Form.Item
              label="关注人"
              name="followerActorIds"
              rules={[{ type: "array", max: 50, message: "关注人不能超过 50 位" }]}
            >
              <Select
                aria-label="关注人"
                disabled={updateMutation.isPending || !canReadOrganization}
                filterOption={false}
                loading={memberQuery.isLoading}
                mode="multiple"
                options={memberOptions}
                showSearch
                onSearch={setMemberKeyword}
              />
            </Form.Item>
            <Form.Item
              label="重复频率"
              name="frequency"
              rules={[{ required: true, message: "请选择重复频率" }]}
            >
              <Select
                aria-label="重复频率"
                disabled={updateMutation.isPending}
                options={frequencyOptions}
                onChange={changeFrequency}
              />
            </Form.Item>
            <Form.Item
              label="重复间隔"
              name="interval"
              rules={[{ required: true, message: "请输入重复间隔" }]}
            >
              <InputNumber
                aria-label="重复间隔"
                disabled={updateMutation.isPending}
                max={intervalMaximum}
                min={1}
                precision={0}
              />
            </Form.Item>
            {frequency === "WEEKLY" ? (
              <Form.Item
                label="每周日期"
                name="weekdays"
                rules={[
                  {
                    validator: (_rule, value: WorkTaskSeriesWeekday[] | undefined) =>
                      Array.isArray(value) && value.length > 0
                        ? Promise.resolve()
                        : Promise.reject(new Error("请至少选择一个每周日期")),
                  },
                ]}
              >
                <Checkbox.Group
                  aria-label="每周日期"
                  disabled={updateMutation.isPending}
                  options={workTaskSeriesWeekdays.map((weekday) => ({
                    label: weekdayLabels[weekday],
                    value: weekday,
                  }))}
                />
              </Form.Item>
            ) : null}
            {frequency === "MONTHLY" ? (
              <>
                <Form.Item label="每月日期" name="monthlyDateKind">
                  <Radio.Group
                    aria-label="每月日期"
                    disabled={updateMutation.isPending}
                    options={[
                      { label: "指定日期", value: "DAY" },
                      { label: "最后一天", value: "LAST_DAY" },
                    ]}
                  />
                </Form.Item>
                {monthlyDateKind === "DAY" ? (
                  <Form.Item
                    label="每月第几日"
                    name="monthDay"
                    rules={[{ required: true, message: "请输入每月日期" }]}
                  >
                    <InputNumber
                      aria-label="每月第几日"
                      disabled={updateMutation.isPending}
                      max={31}
                      min={1}
                      precision={0}
                    />
                  </Form.Item>
                ) : null}
              </>
            ) : null}
            <Form.Item
              label="时区"
              name="zoneId"
              rules={[
                { required: true, whitespace: true, message: "请输入 IANA 时区" },
                {
                  validator: (_rule, value: string | undefined) =>
                    typeof value === "string" && validZoneId(value.trim())
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error("请输入浏览器支持的 IANA 时区，例如 Asia/Shanghai"),
                        ),
                },
              ]}
            >
              <Input
                aria-label="时区"
                disabled={updateMutation.isPending}
                placeholder="Asia/Shanghai"
              />
            </Form.Item>
            <Form.Item
              label="开始日期"
              name="startLocalDate"
              rules={[{ required: true, message: "请选择开始日期" }]}
            >
              <Input aria-label="开始日期" disabled={updateMutation.isPending} type="date" />
            </Form.Item>
            <Form.Item
              label="本地时间"
              name="localTime"
              rules={[{ required: true, message: "请选择本地时间" }]}
            >
              <Input aria-label="本地时间" disabled={updateMutation.isPending} type="time" />
            </Form.Item>
            <Form.Item
              label="结束日期（可选）"
              name="endLocalDate"
              rules={[
                {
                  validator: (_rule, value: string | undefined) => {
                    const startLocalDate = form.getFieldValue("startLocalDate") as
                      string | undefined;
                    return value === undefined ||
                      value.length === 0 ||
                      startLocalDate === undefined ||
                      value >= startLocalDate
                      ? Promise.resolve()
                      : Promise.reject(new Error("结束日期不能早于开始日期"));
                  },
                },
              ]}
            >
              <Input aria-label="结束日期" disabled={updateMutation.isPending} type="date" />
            </Form.Item>
            <Space>
              <Button
                disabled={updateMutation.isPending}
                onClick={() => navigate("/work/task-series")}
              >
                取消
              </Button>
              <Button htmlType="submit" loading={updateMutation.isPending} type="primary">
                保存周期任务
              </Button>
            </Space>
          </Form>
        </Card>
      </main>
    </RouteAuthority>
  );
}
