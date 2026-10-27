import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
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

import { toWorkTaskCreateRequest, type WorkTaskCreateValues } from "../model/work-task-form";
import {
  workTaskBusinessRecordOptions,
  type WorkTaskBusinessRecordType,
} from "../model/work-task-business-record";
import { workTaskPriorityOptions, type WorkTaskPriority } from "../model/work-task-priority";
import { workTaskKeys } from "../model/query-keys";

import styles from "./work-task-create-page.module.css";

interface WorkTaskCreateFormValues {
  title?: string;
  assigneeActorId?: number;
  description?: string;
  priority?: WorkTaskPriority;
  dueTime?: string;
  followerActorIds?: number[];
  businessObjectType?: WorkTaskBusinessRecordType;
  businessRecordId?: number;
}

export function WorkTaskCreatePage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<WorkTaskCreateFormValues>();
  const [memberKeyword, setMemberKeyword] = useState("");
  const [followerMemberKeyword, setFollowerMemberKeyword] = useState("");
  const [followerSelectorOpened, setFollowerSelectorOpened] = useState(false);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadWorkTasks = hasAuthority(authorization, authority.workTasksRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const memberQuery = useQuery({
    queryKey: ["member-selector", "work-task-assignee", identityKey, memberKeyword] as const,
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
      "work-task-create-follower",
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
    mutationFn: (values: WorkTaskCreateValues) => {
      const request = toWorkTaskCreateRequest(values);
      return apiClient === null || request === null
        ? Promise.reject(new Error("任务创建数据暂时不可用。"))
        : apiClient.createWorkTask(request);
    },
    onSuccess: (task) => {
      queryClient.setQueryData(workTaskKeys.detail(identityKey, task.id), task);
      void queryClient.invalidateQueries({ queryKey: workTaskKeys.lists(identityKey) });
      navigate(`/work/tasks/${task.id}`, { replace: true });
    },
  });

  function submit(values: WorkTaskCreateFormValues) {
    if (values.title === undefined || values.assigneeActorId === undefined) return;
    createMutation.mutate({
      assigneeActorId: values.assigneeActorId,
      ...(values.description === undefined ? {} : { description: values.description }),
      ...(values.dueTime === undefined ? {} : { dueTime: values.dueTime }),
      ...(values.followerActorIds === undefined
        ? {}
        : { followerActorIds: values.followerActorIds }),
      ...(values.priority === undefined ? {} : { priority: values.priority }),
      ...(values.businessObjectType === undefined
        ? {}
        : { businessObjectType: values.businessObjectType }),
      ...(values.businessRecordId === undefined
        ? {}
        : { businessRecordId: values.businessRecordId }),
      title: values.title,
    });
  }

  return (
    <RouteAuthority authority={authority.workTasksRead}>
      <RouteAuthority authority={authority.workTasksWrite}>
        <RouteAuthority authority={authority.organizationRead}>
          <main className={styles.page}>
            <section>
              <Typography.Title level={2}>新建 Work 任务</Typography.Title>
              <Typography.Text type="secondary">
                提交任务标题、服务端成员目录中选定的处理人、最多 50
                位关注人，以及可选描述、优先级、到期时间和完整业务关联。未选择优先级时由服务端默认；提醒不会进入请求或缓存。
              </Typography.Text>
            </section>
            {createMutation.isError ? (
              <Alert
                title={
                  createMutation.error instanceof ApiError
                    ? createMutation.error.message
                    : "任务暂时无法创建"
                }
                showIcon
                type="error"
              />
            ) : null}
            <Card title="基本信息">
              {memberQuery.isLoading ? <Spin /> : null}
              {memberQuery.isError ? (
                <Alert title="成员目录暂时无法加载" showIcon type="error" />
              ) : null}
              <Form form={form} layout="vertical" onFinish={submit}>
                <Form.Item
                  label="任务标题"
                  name="title"
                  rules={[
                    { required: true, whitespace: true, message: "请输入任务标题" },
                    { max: 200, message: "任务标题不能超过 200 个字符" },
                  ]}
                >
                  <Input aria-label="任务标题" maxLength={200} placeholder="请输入任务标题" />
                </Form.Item>
                <Form.Item
                  label="处理人"
                  name="assigneeActorId"
                  rules={[{ required: true, message: "请选择处理人" }]}
                >
                  <Select
                    aria-label="处理人"
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
                    options={workTaskPriorityOptions}
                    placeholder="未选择时由服务端默认"
                  />
                </Form.Item>
                <Form.Item label="到期时间（可选）" name="dueTime">
                  <Input
                    aria-label="到期时间"
                    disabled={createMutation.isPending}
                    type="datetime-local"
                  />
                </Form.Item>
                <Form.Item label="关联业务类型（可选）" name="businessObjectType">
                  <Select
                    allowClear
                    aria-label="关联业务类型"
                    disabled={createMutation.isPending}
                    options={workTaskBusinessRecordOptions}
                    placeholder="选择后填写服务端记录 ID"
                    onChange={(value: WorkTaskBusinessRecordType | undefined) => {
                      if (value === undefined) form.setFieldValue("businessRecordId", undefined);
                    }}
                  />
                </Form.Item>
                <Form.Item
                  dependencies={["businessObjectType"]}
                  label="关联业务记录 ID（可选）"
                  name="businessRecordId"
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_rule, value: unknown) {
                        const type = getFieldValue("businessObjectType") as unknown;
                        const typeSelected = typeof type === "string" && type.length > 0;
                        const idMissing = value === undefined || value === null || value === "";
                        if (!typeSelected && idMissing) return Promise.resolve();
                        if (!typeSelected || idMissing) {
                          return Promise.reject(new Error("请同时选择关联业务类型和记录 ID"));
                        }
                        if (
                          typeof value !== "number" ||
                          !Number.isSafeInteger(value) ||
                          value <= 0
                        ) {
                          return Promise.reject(new Error("请输入有效的关联业务记录 ID"));
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <InputNumber
                    aria-label="关联业务记录 ID"
                    disabled={createMutation.isPending}
                    min={1}
                    precision={0}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Typography.Paragraph type="secondary">
                  仅接受你明确输入的记录 ID。服务端会在创建时重新确认该 CRM
                  记录当前可写；未通过时不会创建任务。
                </Typography.Paragraph>
                <Space>
                  <Button onClick={() => navigate("/work/tasks")}>取消</Button>
                  <Button
                    disabled={!canReadWorkTasks || memberQuery.isError}
                    htmlType="submit"
                    loading={createMutation.isPending}
                    type="primary"
                  >
                    创建任务
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
