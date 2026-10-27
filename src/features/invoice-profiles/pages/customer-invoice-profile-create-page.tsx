import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Input, Space, Typography } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { StatusPage } from "~/components/feedback/status-page";

import { toPersonalInvoiceProfileCreateRequest } from "../model/invoice-profile-form";
import { invoiceProfileKeys } from "../model/query-keys";

import styles from "./customer-invoice-profile-create-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

interface PersonalInvoiceProfileCreateFormValues {
  title?: string;
}

export function CustomerInvoiceProfileCreatePage() {
  const { customerId: customerIdParam } = useParams();
  const customerId = parseRouteId(customerIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const canReadInvoices = hasAuthority(authorization, authority.invoicesRead);
  const [createdProfileId, setCreatedProfileId] = useState<number | null>(null);
  const listPath = `/crm/customers/${customerId ?? ""}/invoice-profiles`;
  const returnPath = canReadInvoices ? listPath : `/crm/customers/${customerId ?? ""}`;
  const createMutation = useMutation({
    mutationFn: (title: string) =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Invoice profile creation is unavailable."))
        : apiClient.createInvoiceProfile(
            toPersonalInvoiceProfileCreateRequest({ customerId, title }),
          ),
    onSuccess: (profile) => {
      if (profile.customerId === customerId && canReadInvoices) {
        queryClient.invalidateQueries({ queryKey: invoiceProfileKeys.lists(identityKey) });
        navigate(`/crm/customers/${profile.customerId}/invoice-profiles`, { replace: true });
      } else {
        setCreatedProfileId(profile.id);
      }
    },
  });

  function submit(values: PersonalInvoiceProfileCreateFormValues) {
    const title = values.title?.trim();
    if (title === undefined || title === "") return;
    createMutation.mutate(title);
  }

  if (customerId === null) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.invoicesWrite}>
      <RouteAuthority authority={authority.customersRead}>
        <main className={styles.page}>
          <section>
            <Button icon={<ArrowLeftOutlined />} type="link" onClick={() => navigate(returnPath)}>
              返回开票资料
            </Button>
            <Typography.Title level={2}>新建个人抬头</Typography.Title>
            <Typography.Text type="secondary">
              仅提交当前客户和用户确认的个人抬头；不采集税号、银行账户、注册地址、电话或备注。
            </Typography.Text>
          </section>
          {createMutation.isError ? (
            <Alert
              title={
                createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : "开票资料暂时无法创建"
              }
              showIcon
              type="error"
            />
          ) : null}
          {createdProfileId !== null ? (
            <Alert
              description="当前成员没有开票资料读取权限，无法自动打开列表；后续可见范围仍由服务端决定。"
              title={`开票资料已创建，编号 ${createdProfileId}`}
              showIcon
              type="success"
            />
          ) : null}
          <Card title="基本信息">
            <Form layout="vertical" onFinish={submit}>
              <Form.Item label="关联客户">
                <Typography.Text>客户 {customerId}</Typography.Text>
              </Form.Item>
              <Form.Item label="抬头类型">
                <Typography.Text>个人</Typography.Text>
              </Form.Item>
              <Form.Item
                label="开票抬头"
                name="title"
                rules={[
                  { required: true, whitespace: true, message: "请输入开票抬头" },
                  { max: 200, message: "开票抬头不能超过 200 个字符" },
                ]}
              >
                <Input
                  aria-label="开票抬头"
                  disabled={createMutation.isPending}
                  maxLength={200}
                  placeholder="请输入个人开票抬头"
                />
              </Form.Item>
              <Typography.Paragraph type="secondary">
                服务端会重新校验客户可见性、开票资料写入权限和每位客户的资料上限；组织抬头与敏感资料字段在独立流程中处理。
              </Typography.Paragraph>
              <Space>
                <Button disabled={createMutation.isPending} onClick={() => navigate(returnPath)}>
                  取消
                </Button>
                <Button htmlType="submit" loading={createMutation.isPending} type="primary">
                  创建个人抬头
                </Button>
              </Space>
            </Form>
          </Card>
        </main>
      </RouteAuthority>
    </RouteAuthority>
  );
}
