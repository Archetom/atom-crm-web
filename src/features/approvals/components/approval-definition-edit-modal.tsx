import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Form, Input, Modal, Select, Space, Spin, Typography } from "antd";
import { useEffect, useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import {
  toApprovalDefinitionUpdateRequest,
  type ApprovalDefinitionEditValues,
} from "../model/approval-definition-edit";
import { approvalDefinitionObjectTypeLabels } from "../model/approval-definition-labels";
import { approvalDefinitionKeys } from "../model/approval-definition-query-keys";

interface ApprovalDefinitionEditModalProps {
  definitionId: number | null;
  onClose: () => void;
}

interface ApprovalDefinitionEditFormValues {
  approverActorIds?: number[];
  managerActorIds?: number[];
  name?: string;
  stepMode?: ApprovalDefinitionEditValues["stepMode"];
}

/** Replaces only an inactive definition that exactly matches the Web's minimal draft template. */
export function ApprovalDefinitionEditModal({
  definitionId,
  onClose,
}: Readonly<ApprovalDefinitionEditModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<ApprovalDefinitionEditFormValues>();
  const [formError, setFormError] = useState<string | null>(null);
  const [memberKeyword, setMemberKeyword] = useState("");
  const identityKey = authState?.identityKey ?? "approval-definition-edit";
  const canManageApprovals = hasAuthority(authorization, authority.approvalsManage);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const baselineQuery = useQuery({
    queryKey: approvalDefinitionKeys.edit(identityKey, definitionId ?? 0),
    queryFn: () =>
      definitionId === null || apiClient === null
        ? Promise.reject(new Error("审批定义编辑暂时不可用。"))
        : apiClient.getApprovalDefinitionEditableBaseline(definitionId),
    enabled:
      definitionId !== null && apiClient !== null && canManageApprovals && canReadOrganization,
  });
  const memberQuery = useQuery({
    queryKey: ["member-selector", "approval-definition-edit", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("成员选择暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: memberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled:
      definitionId !== null && apiClient !== null && canManageApprovals && canReadOrganization,
  });
  const updateMutation = useMutation({
    mutationFn: (values: ApprovalDefinitionEditValues) => {
      const baseline = baselineQuery.data;
      const request =
        baseline === undefined ? null : toApprovalDefinitionUpdateRequest(baseline, values);
      return apiClient === null || definitionId === null || request === null
        ? Promise.reject(new Error("审批定义最小模板数据不完整。"))
        : apiClient.updateApprovalDefinition(definitionId, request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: approvalDefinitionKeys.all });
      close();
    },
  });

  useEffect(() => {
    const baseline = baselineQuery.data;
    if (baseline === undefined) return;
    form.setFieldsValue({
      approverActorIds: baseline.approverActorIds,
      managerActorIds: baseline.managerActorIds,
      name: baseline.name,
      stepMode: baseline.stepMode,
    });
  }, [baselineQuery.data, form]);

  function close() {
    form.resetFields();
    setFormError(null);
    setMemberKeyword("");
    onClose();
  }

  function submit(values: ApprovalDefinitionEditFormValues) {
    if (
      values.approverActorIds === undefined ||
      values.managerActorIds === undefined ||
      values.name === undefined ||
      values.stepMode === undefined
    ) {
      return;
    }
    const requestValues: ApprovalDefinitionEditValues = {
      approverActorIds: values.approverActorIds,
      managerActorIds: values.managerActorIds,
      name: values.name,
      stepMode: values.stepMode,
    };
    if (
      baselineQuery.data === undefined ||
      toApprovalDefinitionUpdateRequest(baselineQuery.data, requestValues) === null
    ) {
      setFormError("最小模板数据不完整或无效，请检查名称与成员选择。");
      return;
    }
    setFormError(null);
    updateMutation.mutate(requestValues);
  }

  const memberOptions = (memberQuery.data ?? []).map((member) => ({
    label: member.displayName,
    value: member.actorId,
  }));

  return (
    <Modal
      destroyOnHidden
      footer={null}
      open={definitionId !== null}
      title="编辑最小审批模板"
      onCancel={close}
    >
      <Typography.Paragraph type="secondary">
        仅当服务端定义精确匹配初始停用的单成员步骤模板时才可编辑。复杂步骤、条件、部门、角色、发起范围和已启用定义会被拒绝，不会被浏览器部分读取或重写。
      </Typography.Paragraph>
      {baselineQuery.isLoading ? <Spin /> : null}
      {baselineQuery.isError ? (
        <Alert
          title={
            baselineQuery.error instanceof ApiError
              ? baselineQuery.error.message
              : "当前定义不是可安全编辑的最小模板"
          }
          showIcon
          type="error"
        />
      ) : null}
      {memberQuery.isError ? <Alert title="成员目录暂时无法加载" showIcon type="error" /> : null}
      {formError !== null ? <Alert title={formError} showIcon type="warning" /> : null}
      {updateMutation.isError ? (
        <Alert
          title={
            updateMutation.error instanceof ApiError
              ? updateMutation.error.message
              : "审批定义暂时无法更新"
          }
          showIcon
          type="error"
        />
      ) : null}
      {baselineQuery.data !== undefined ? (
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item label="业务对象">
            <Input
              readOnly
              value={approvalDefinitionObjectTypeLabels[baselineQuery.data.objectType]}
            />
          </Form.Item>
          <Form.Item
            label="定义名称"
            name="name"
            rules={[
              { required: true, whitespace: true, message: "请输入定义名称" },
              { max: 200, message: "定义名称不能超过 200 个字符" },
            ]}
          >
            <Input aria-label="定义名称" maxLength={200} />
          </Form.Item>
          <Form.Item
            label="审批成员"
            name="approverActorIds"
            rules={[{ required: true, message: "请选择审批成员" }]}
          >
            <Select
              aria-label="审批成员"
              filterOption={false}
              loading={memberQuery.isLoading}
              mode="multiple"
              notFoundContent={memberQuery.isLoading ? <Spin size="small" /> : "未找到可选择成员"}
              options={memberOptions}
              showSearch
              onSearch={setMemberKeyword}
            />
          </Form.Item>
          <Form.Item label="审批方式" name="stepMode" rules={[{ required: true }]}>
            <Select
              aria-label="审批方式"
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
              loading={memberQuery.isLoading}
              mode="multiple"
              notFoundContent={memberQuery.isLoading ? <Spin size="small" /> : "未找到可选择成员"}
              options={memberOptions}
              showSearch
              onSearch={setMemberKeyword}
            />
          </Form.Item>
          <Space>
            <Button onClick={close}>取消</Button>
            <Button
              disabled={memberQuery.isError || !canManageApprovals || !canReadOrganization}
              htmlType="submit"
              loading={updateMutation.isPending}
              type="primary"
            >
              保存最小模板
            </Button>
          </Space>
        </Form>
      ) : null}
    </Modal>
  );
}
