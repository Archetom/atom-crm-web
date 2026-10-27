import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Input, List, Modal, Space, Typography } from "antd";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import type { CustomerOption } from "~/components/entity-selector/customer-option";

import {
  customerContextGlobalListPath,
  customerContextNestedCreatePath,
} from "./customer-context-create-route";

import styles from "./customer-context-create-gateway.module.css";

interface CustomerContextCreateGatewayProps {
  createPath(customerId: number): string;
  description: string;
  listPath: string;
  title: string;
  writeAuthority: string;
}

/**
 * Starts a customer-bound creation flow without creating a local draft or
 * accepting a raw customer ID. The selected customer is always server-visible.
 */
export function CustomerContextCreateGateway({
  createPath,
  description,
  listPath,
  title,
  writeAuthority,
}: Readonly<CustomerContextCreateGatewayProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerKeyword, setCustomerKeyword] = useState("");
  const identityKey = authState?.identityKey ?? "pending";
  const createSearch = searchParams.toString();
  const returnPath = customerContextGlobalListPath(listPath, createSearch) ?? listPath;
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const customerCandidateQuery = useQuery({
    queryKey: ["customer-context-create-selector", identityKey, listPath, customerKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer selection is unavailable."))
        : apiClient.getVisibleCustomers({
            keyword: customerKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: apiClient !== null && customerPickerOpen && canReadCustomers,
  });

  function closeCustomerPicker() {
    setCustomerPickerOpen(false);
    setCustomerKeyword("");
  }

  function chooseCustomer(customer: CustomerOption) {
    navigate(customerContextNestedCreatePath(createPath(customer.id), createSearch), {
      replace: true,
    });
  }

  return (
    <RouteAuthority authority={writeAuthority}>
      <main className={styles.page}>
        <section>
          <Typography.Title level={2}>{title}</Typography.Title>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </section>
        {!canReadCustomers ? (
          <Alert
            description="请联系管理员补充客户读取权限后再选择关联客户。"
            title="缺少关联客户目录权限"
            showIcon
            type="warning"
          />
        ) : null}
        <Card title="关联客户">
          <Typography.Paragraph type="secondary">
            关联客户仅能从服务端返回的当前可见范围选择；进入下一步后，服务端仍会重新校验创建权限和数据范围。
          </Typography.Paragraph>
          <Space>
            <Button
              disabled={!canReadCustomers}
              type="primary"
              onClick={() => setCustomerPickerOpen(true)}
            >
              选择客户并继续
            </Button>
            <Button onClick={() => navigate(returnPath)}>取消</Button>
          </Space>
        </Card>
      </main>
      <Modal
        destroyOnHidden
        footer={null}
        open={customerPickerOpen}
        title="选择关联客户"
        onCancel={closeCustomerPicker}
      >
        <Typography.Paragraph type="secondary">
          候选仅来自服务端返回的当前可见客户；选择后仍会在提交时由服务端核验。
        </Typography.Paragraph>
        <Input.Search
          allowClear
          aria-label="搜索可见客户"
          placeholder="搜索可见客户"
          value={customerKeyword}
          onChange={(event) => setCustomerKeyword(event.currentTarget.value)}
        />
        {customerCandidateQuery.isError ? (
          <Alert
            title={
              customerCandidateQuery.error instanceof ApiError
                ? customerCandidateQuery.error.message
                : "客户候选列表暂时无法加载，请稍后重试"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : (
          <List
            dataSource={[...(customerCandidateQuery.data ?? [])]}
            loading={customerCandidateQuery.isLoading}
            locale={{ emptyText: "未找到可选择客户" }}
            renderItem={(customer) => (
              <List.Item
                actions={[
                  <Button key={customer.id} type="link" onClick={() => chooseCustomer(customer)}>
                    选择客户
                  </Button>,
                ]}
              >
                <List.Item.Meta description={`客户 ${customer.id}`} title={customer.name} />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </RouteAuthority>
  );
}
