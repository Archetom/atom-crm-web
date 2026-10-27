import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Form, Input, Modal, Space, Typography } from "antd";
import { useState } from "react";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority } from "~/app/permissions/authority";

interface MemberProfileFormValues {
  displayName?: string;
  email?: string;
  phoneNumber?: string;
}

function errorMessage(error: Error | null): string | undefined {
  if (error === null) return undefined;
  return error instanceof ApiError ? error.message : "个人资料暂时无法保存，请稍后重试。";
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/** Self-service local profile editor; it never changes authentication or tenant selection. */
export function MemberProfileModal({
  open,
  onClose,
}: Readonly<{
  open: boolean;
  onClose(): void;
}>) {
  const { apiClient } = useBootstrap();
  const [form] = Form.useForm<MemberProfileFormValues>();
  const [savedProfile, setSavedProfile] = useState<
    components["schemas"]["MemberProfileResponse"] | null
  >(null);
  const saveMutation = useMutation({
    mutationFn: (request: components["schemas"]["MemberProfileUpdateRequest"]) =>
      apiClient === null
        ? Promise.reject(new Error("Member profile API is unavailable."))
        : apiClient.updateMyProfile(request),
    onSuccess: (profile) => {
      setSavedProfile(profile);
    },
  });

  function close() {
    if (saveMutation.isPending) return;
    saveMutation.reset();
    form.resetFields();
    setSavedProfile(null);
    onClose();
  }

  function submit(values: MemberProfileFormValues) {
    const displayName = optionalText(values.displayName);
    const email = optionalText(values.email);
    const phoneNumber = optionalText(values.phoneNumber);
    if (displayName === undefined) return;
    setSavedProfile(null);
    saveMutation.mutate({
      displayName,
      ...(email === undefined ? {} : { email }),
      ...(phoneNumber === undefined ? {} : { phoneNumber }),
    });
  }

  return (
    <ActionAuthority authority={authority.organizationRequest}>
      <Modal destroyOnHidden footer={null} open={open} title="更新我的资料" onCancel={close}>
        <Typography.Paragraph type="secondary">
          此处仅更新当前调用者的本地显示资料，不会变更登录身份、当前租户、成员资格或权限。
        </Typography.Paragraph>
        {savedProfile !== null ? (
          <Alert title={`已保存成员 ${savedProfile.actorId} 的资料。`} showIcon type="success" />
        ) : null}
        {saveMutation.error !== null ? (
          <Alert title={errorMessage(saveMutation.error)} showIcon type="error" />
        ) : null}
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            label="显示名称"
            name="displayName"
            rules={[
              { required: true, whitespace: true, message: "请输入显示名称" },
              { max: 100, message: "显示名称不能超过 100 个字符" },
            ]}
          >
            <Input aria-label="显示名称" autoComplete="name" maxLength={100} />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ type: "email", message: "请输入有效的邮箱地址" }]}
          >
            <Input aria-label="邮箱" autoComplete="email" maxLength={254} type="email" />
          </Form.Item>
          <Form.Item
            label="手机号码"
            name="phoneNumber"
            rules={[
              {
                pattern: /^\+[1-9]\d{7,14}$/,
                message: "手机号码请使用 E.164 格式，例如 +8613812345678",
              },
            ]}
          >
            <Input
              aria-label="手机号码"
              autoComplete="tel"
              inputMode="tel"
              maxLength={16}
              placeholder="例如 +8613812345678"
              type="tel"
            />
          </Form.Item>
          <Space>
            <Button onClick={close}>关闭</Button>
            <Button htmlType="submit" loading={saveMutation.isPending} type="primary">
              保存资料
            </Button>
          </Space>
        </Form>
      </Modal>
    </ActionAuthority>
  );
}
