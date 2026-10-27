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
  Typography,
} from "antd";
import { useState } from "react";
import { useNavigate } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";

import {
  toWorkTaskSeriesCreateRequest,
  type WorkTaskSeriesCreateValues,
} from "../model/work-task-series-form";
import {
  workTaskSeriesWeekdays,
  type WorkTaskSeriesFrequency,
  type WorkTaskSeriesWeekday,
} from "../model/work-task-series-list-item";
import { type WorkTaskSeriesPriority } from "../model/work-task-series-detail";
import { workTaskSeriesKeys } from "../model/series-query-keys";

import styles from "./work-task-series-create-page.module.css";

type MonthlyDateKind = "DAY" | "LAST_DAY";

interface WorkTaskSeriesCreateFormValues {
  title?: string;
  assigneeActorId?: number;
  followerActorIds?: number[];
  description?: string;
  priority?: WorkTaskSeriesPriority;
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

export function WorkTaskSeriesCreatePage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<WorkTaskSeriesCreateFormValues>();
  const [memberKeyword, setMemberKeyword] = useState("");
  const [followerMemberKeyword, setFollowerMemberKeyword] = useState("");
  const [followerSelectorOpened, setFollowerSelectorOpened] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadWorkTasks = hasAuthority(authorization, authority.workTasksRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const frequency = Form.useWatch("frequency", form);
  const monthlyDateKind = Form.useWatch("monthlyDateKind", form);
  const memberQuery = useQuery({
    queryKey: ["member-selector", "work-task-series-assignee", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("成员选择暂时不可用。"))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: memberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && canReadWorkTasks && canReadOrganization,
  });
  const followerMemberQuery = useQuery({
    queryKey: [
      "member-selector",
      "work-task-series-create-follower",
      identityKey,
      followerMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("成员选择暂时不可用。"))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: followerMemberKeyword.trim() || undefined,
          }),
    enabled:
      apiClient !== null && canReadWorkTasks && canReadOrganization && followerSelectorOpened,
  });
  const createMutation = useMutation({
    mutationFn: (values: WorkTaskSeriesCreateValues) => {
      const request = toWorkTaskSeriesCreateRequest(values);
      return apiClient === null || request === null
        ? Promise.reject(new Error("周期任务创建数据暂时不可用。"))
        : apiClient.createWorkTaskSeries(request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workTaskSeriesKeys.lists(identityKey) });
      navigate("/work/task-series", { replace: true });
    },
  });

  function submit(values: WorkTaskSeriesCreateFormValues) {
    if (
      values.title === undefined ||
      values.assigneeActorId === undefined ||
      values.frequency === undefined ||
      values.interval === undefined ||
      values.zoneId === undefined ||
      values.startLocalDate === undefined ||
      values.localTime === undefined
    ) {
      return;
    }
    const requestValues: WorkTaskSeriesCreateValues = {
      assigneeActorId: values.assigneeActorId,
      ...(values.description === undefined ? {} : { description: values.description }),
      ...(values.endLocalDate === undefined ? {} : { endLocalDate: values.endLocalDate }),
      ...(values.followerActorIds === undefined
        ? {}
        : { followerActorIds: values.followerActorIds }),
      frequency: values.frequency,
      interval: values.interval,
      lastDayOfMonth: values.frequency === "MONTHLY" && values.monthlyDateKind === "LAST_DAY",
      localTime: values.localTime,
      ...(values.frequency === "MONTHLY" && values.monthlyDateKind === "DAY"
        ? { monthDay: values.monthDay }
        : {}),
      startLocalDate: values.startLocalDate,
      ...(values.priority === undefined ? {} : { priority: values.priority }),
      title: values.title,
      weekdays: values.frequency === "WEEKLY" ? (values.weekdays ?? []) : [],
      zoneId: values.zoneId,
    };
    if (toWorkTaskSeriesCreateRequest(requestValues) === null) {
      setFormError("周期规则不完整或无效，请检查日期、时间、时区和重复条件。");
      return;
    }
    setFormError(null);
    createMutation.mutate(requestValues);
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

  const intervalMaximum = frequency === "DAILY" ? 365 : frequency === "MONTHLY" ? 24 : 52;

  return (
    <RouteAuthority authority={authority.workTasksRead}>
      <RouteAuthority authority={authority.workTasksWrite}>
        <RouteAuthority authority={authority.organizationRead}>
          <main className={styles.page}>
            <section>
              <Typography.Title level={2}>新建周期任务</Typography.Title>
              <Typography.Text type="secondary">
                仅创建草稿模板：提交标题、服务端成员目录中的处理人、可选描述、优先级、最多 50
                位唯一关注人和完整日历规则。未选择优先级时由服务端默认；自动化状态、实例和未来提醒模板均不进入请求或缓存，是否启用由后续经审查的操作单独决定。
              </Typography.Text>
            </section>
            {formError !== null ? <Alert title={formError} showIcon type="warning" /> : null}
            {createMutation.isError ? (
              <Alert
                title={
                  createMutation.error instanceof ApiError
                    ? createMutation.error.message
                    : "周期任务暂时无法创建"
                }
                showIcon
                type="error"
              />
            ) : null}
            <Card title="周期规则">
              {memberQuery.isLoading ? <Spin /> : null}
              {memberQuery.isError ? (
                <Alert title="成员目录暂时无法加载" showIcon type="error" />
              ) : null}
              <Form
                form={form}
                initialValues={{
                  frequency: "WEEKLY",
                  interval: 1,
                  localTime: "09:00",
                  monthlyDateKind: "DAY",
                  zoneId: "Asia/Shanghai",
                }}
                layout="vertical"
                onFinish={submit}
              >
                <Form.Item
                  label="周期任务标题"
                  name="title"
                  rules={[
                    { required: true, whitespace: true, message: "请输入周期任务标题" },
                    { max: 200, message: "周期任务标题不能超过 200 个字符" },
                  ]}
                >
                  <Input
                    aria-label="周期任务标题"
                    disabled={createMutation.isPending}
                    maxLength={200}
                  />
                </Form.Item>
                <Form.Item
                  label="任务描述（可选）"
                  name="description"
                  rules={[{ max: 10_000, message: "任务描述不能超过 10000 个字符" }]}
                >
                  <Input.TextArea
                    aria-label="任务描述"
                    disabled={createMutation.isPending}
                    maxLength={10_000}
                    placeholder="请输入任务描述"
                    rows={5}
                  />
                </Form.Item>
                <Form.Item label="优先级（可选）" name="priority">
                  <Select
                    allowClear
                    aria-label="优先级"
                    disabled={createMutation.isPending}
                    options={priorityOptions}
                    placeholder="未选择时由服务端默认"
                  />
                </Form.Item>
                <Form.Item
                  label="处理人"
                  name="assigneeActorId"
                  rules={[{ required: true, message: "请选择处理人" }]}
                >
                  <Select
                    aria-label="处理人"
                    disabled={createMutation.isPending}
                    filterOption={false}
                    loading={memberQuery.isLoading}
                    notFoundContent={
                      memberQuery.isLoading ? <Spin size="small" /> : "未找到可选择成员"
                    }
                    options={(memberQuery.data ?? []).map((member) => ({
                      label: member.displayName,
                      value: member.actorId,
                    }))}
                    placeholder="从服务端成员目录选择"
                    showSearch
                    onSearch={setMemberKeyword}
                  />
                </Form.Item>
                <Form.Item
                  label="关注人（可选）"
                  name="followerActorIds"
                  rules={[{ type: "array", max: 50, message: "关注人不能超过 50 位" }]}
                >
                  <Select
                    aria-label="关注人"
                    disabled={createMutation.isPending}
                    filterOption={false}
                    loading={followerMemberQuery.isLoading}
                    maxCount={50}
                    mode="multiple"
                    notFoundContent={
                      followerMemberQuery.isLoading ? (
                        <Spin size="small" />
                      ) : followerMemberQuery.isError ? (
                        "成员目录暂时无法加载"
                      ) : (
                        "未找到可选择成员"
                      )
                    }
                    options={(followerMemberQuery.data ?? []).map((member) => ({
                      label: member.displayName,
                      value: member.actorId,
                    }))}
                    placeholder="从服务端成员目录选择，可多选"
                    showSearch
                    onDropdownVisibleChange={(open) => {
                      if (open) setFollowerSelectorOpened(true);
                    }}
                    onSearch={setFollowerMemberKeyword}
                  />
                </Form.Item>
                <Form.Item
                  label="重复频率"
                  name="frequency"
                  rules={[{ required: true, message: "请选择重复频率" }]}
                >
                  <Select
                    aria-label="重复频率"
                    disabled={createMutation.isPending}
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
                    disabled={createMutation.isPending}
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
                      disabled={createMutation.isPending}
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
                        disabled={createMutation.isPending}
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
                          disabled={createMutation.isPending}
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
                    disabled={createMutation.isPending}
                    placeholder="Asia/Shanghai"
                  />
                </Form.Item>
                <Form.Item
                  label="开始日期"
                  name="startLocalDate"
                  rules={[{ required: true, message: "请选择开始日期" }]}
                >
                  <Input aria-label="开始日期" disabled={createMutation.isPending} type="date" />
                </Form.Item>
                <Form.Item
                  label="本地时间"
                  name="localTime"
                  rules={[{ required: true, message: "请选择本地时间" }]}
                >
                  <Input aria-label="本地时间" disabled={createMutation.isPending} type="time" />
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
                  <Input aria-label="结束日期" disabled={createMutation.isPending} type="date" />
                </Form.Item>
                <Space>
                  <Button
                    disabled={createMutation.isPending}
                    onClick={() => navigate("/work/task-series")}
                  >
                    取消
                  </Button>
                  <Button
                    disabled={!canReadWorkTasks || memberQuery.isError}
                    htmlType="submit"
                    loading={createMutation.isPending}
                    type="primary"
                  >
                    创建草稿周期任务
                  </Button>
                </Space>
              </Form>
            </Card>
          </main>
        </RouteAuthority>
      </RouteAuthority>
    </RouteAuthority>
  );
}
