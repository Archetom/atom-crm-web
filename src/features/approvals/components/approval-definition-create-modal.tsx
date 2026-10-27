import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Form, Input, Modal, Select, Space, Spin, Typography } from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import {
  toApprovalDefinitionCreateRequest,
  type ApprovalDefinitionCreateValues,
  type ApprovalStepMode,
} from "../model/approval-definition-create";
import { approvalDefinitionObjectTypeLabels } from "../model/approval-definition-labels";
import { approvalDefinitionObjectTypes } from "../model/approval-definition-list-item";
import { approvalDefinitionKeys } from "../model/approval-definition-query-keys";

interface ApprovalDefinitionCreateModalProps {
  open: boolean;
  onClose: () => void;
}

interface ApprovalDefinitionCreateFormValues {
  approverActorIds?: number[];
  managerActorIds?: number[];
  name?: string;
  objectType?: ApprovalDefinitionCreateValues["objectType"];
  stepMode?: ApprovalStepMode;
}

const defaultValues: Pick<ApprovalDefinitionCreateFormValues, "objectType" | "stepMode"> = {
  objectType: "CUSTOMER",
  stepMode: "ANY",
};

/** Creates an inactive one-step member-routing draft from server-visible member choices. */
export function ApprovalDefinitionCreateModal({
  open,
  onClose,
}: Readonly<ApprovalDefinitionCreateModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<ApprovalDefinitionCreateFormValues>();
  const [memberKeyword, setMemberKeyword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const identityKey = authState?.identityKey ?? "approval-definition-create";
  const canManageApprovals = hasAuthority(authorization, authority.approvalsManage);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const memberQuery = useQuery({
    queryKey: ["member-selector", "approval-definition", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("成员选择暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: memberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: open && apiClient !== null && canManageApprovals && canReadOrganization,
  });
  const createMutation = useMutation({
    mutationFn: (values: ApprovalDefinitionCreateValues) => {
      const request = toApprovalDefinitionCreateRequest(values);
      return apiClient === null || request === null
        ? Promise.reject(new Error("审批定义草稿数据不完整。"))
        : apiClient.createApprovalDefinition(request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: approvalDefinitionKeys.all });
      close();
    },
  });

  function close() {
    form.resetFields();
    form.setFieldsValue(defaultValues);
    setFormError(null);
    setMemberKeyword("");
    onClose();
  }

  function submit(values: ApprovalDefinitionCreateFormValues) {
    if (
      values.approverActorIds === undefined ||
      values.managerActorIds === undefined ||
      values.name === undefined ||
      values.objectType === undefined ||
      values.stepMode === undefined
    ) {
      return;
    }

    const requestValues: ApprovalDefinitionCreateValues = {
      approverActorIds: values.approverActorIds,
      managerActorIds: values.managerActorIds,
      name: values.name,
      objectType: values.objectType,
      stepMode: values.stepMode,
    };
    if (toApprovalDefinitionCreateRequest(requestValues) === null) {
      setFormError("定义草稿不完整或无效，请检查名称与成员选择。");
      return;
    }

    setFormError(null);
    createMutation.mutate(requestValues);
  }

  const memberOptions = (memberQuery.data ?? []).map((member) => ({
    label: member.displayName,
    value: member.actorId,
  }));

  return (
    <Modal destroyOnHidden footer={null} open={open} title="新建停用审批定义" onCancel={close}>
      <Typography.Paragraph type="secondary">
        仅创建一个初始停用的最小模板：一个成员审批步骤、一次性流转和“无有效审批人时转审批管理员”。不写入描述、发起人范围、部门、角色、条件或版本；启用、编辑和扩展路由将在后续独立流程中提供。
      </Typography.Paragraph>
      {formError !== null ? <Alert title={formError} showIcon type="warning" /> : null}
      {createMutation.isError ? (
        <Alert
          title={
            createMutation.error instanceof ApiError
              ? createMutation.error.message
              : "审批定义暂时无法创建"
          }
          showIcon
          type="error"
        />
      ) : null}
      {memberQuery.isError ? <Alert title="成员目录暂时无法加载" showIcon type="error" /> : null}
      <Form form={form} initialValues={defaultValues} layout="vertical" onFinish={submit}>
        <Form.Item
          label="定义名称"
          name="name"
          rules={[
            { required: true, whitespace: true, message: "请输入定义名称" },
            { max: 200, message: "定义名称不能超过 200 个字符" },
          ]}
        >
          <Input aria-label="定义名称" maxLength={200} placeholder="例如：客户折扣审批" />
        </Form.Item>
        <Form.Item label="业务对象" name="objectType" rules={[{ required: true }]}>
          <Select
            aria-label="业务对象"
            getPopupContainer={(node) => node.parentElement ?? document.body}
            options={approvalDefinitionObjectTypes.map((objectType) => ({
              label: approvalDefinitionObjectTypeLabels[objectType],
              value: objectType,
            }))}
          />
        </Form.Item>
        <Form.Item
          label="审批成员"
          name="approverActorIds"
          rules={[{ required: true, message: "请选择审批成员" }]}
        >
          <Select
            aria-label="审批成员"
            filterOption={false}
            getPopupContainer={(node) => node.parentElement ?? document.body}
            loading={memberQuery.isLoading}
            mode="multiple"
            notFoundContent={memberQuery.isLoading ? <Spin size="small" /> : "未找到可选择成员"}
            options={memberOptions}
            placeholder="从服务端成员目录选择"
            showSearch
            onSearch={setMemberKeyword}
          />
        </Form.Item>
        <Form.Item label="审批方式" name="stepMode" rules={[{ required: true }]}>
          <Select
            aria-label="审批方式"
            getPopupContainer={(node) => node.parentElement ?? document.body}
            options={[
              { label: "任一成员通过即可", value: "ANY" },
              { label: "所有成员都需通过", value: "ALL" },
            ]}
          />
        </Form.Item>
        <Form.Item
          label="审批管理员"
          name="managerActorIds"
          rules={[{ required: true, message: "请选择审批管理员" }]}
        >
          <Select
            aria-label="审批管理员"
            filterOption={false}
            getPopupContainer={(node) => node.parentElement ?? document.body}
            loading={memberQuery.isLoading}
            mode="multiple"
            notFoundContent={memberQuery.isLoading ? <Spin size="small" /> : "未找到可选择成员"}
            options={memberOptions}
            placeholder="无有效审批人时接手"
            showSearch
            onSearch={setMemberKeyword}
          />
        </Form.Item>
        <Space>
          <Button onClick={close}>取消</Button>
          <Button
            disabled={!canManageApprovals || !canReadOrganization || memberQuery.isError}
            htmlType="submit"
            loading={createMutation.isPending}
            type="primary"
          >
            创建停用审批定义
          </Button>
        </Space>
      </Form>
    </Modal>
  );
}
