import { useQuery } from "@tanstack/react-query";
import { Button, Card, Empty, List, Space, Tag, Typography } from "antd";
import { Link, useNavigate } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { DataWorkspace } from "~/components/page/data-workspace";
import { FilterBar } from "~/components/page/filter-bar";
import { PageHeader } from "~/components/page/page-header";

import type { ContactPoolCatalogItem } from "../model/contact-pool-catalog";
import { contactPoolKeys } from "../model/query-keys";

import styles from "./contact-pool-catalog-page.module.css";

function statusLabel(status: ContactPoolCatalogItem["status"]): string {
  if (status === "ACTIVE") return "启用";
  if (status === "INACTIVE") return "停用";
  return "已删除";
}

function statusColor(status: ContactPoolCatalogItem["status"]): string | undefined {
  if (status === "ACTIVE") return "green";
  if (status === "INACTIVE") return "default";
  return "red";
}

export function ContactPoolCatalogPage() {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const identityKey = authState?.identityKey ?? "pending";
  const catalogQuery = useQuery({
    queryKey: contactPoolKeys.catalog(identityKey),
    queryFn: () =>
      apiClient?.getContactPoolCatalog() ??
      Promise.reject(new Error("Contact pool catalog API is unavailable.")),
    enabled: apiClient !== null,
  });

  return (
    <RouteAuthority authority={authority.contactPoolsRead}>
      <main>
        <PageHeader
          description="仅展示服务端确认当前成员可访问的公海；联系人范围和后续操作仍由服务端逐项校验。"
          title="联系人公海"
        />
        <FilterBar
          trailing={
            <ActionAuthority authority={authority.contactPoolsManage}>
              <Button type="primary" onClick={() => navigate("/crm/contact-pools/manage")}>
                管理公海配置
              </Button>
            </ActionAuthority>
          }
        />
        <DataWorkspace
          errorMessage={
            catalogQuery.isError
              ? catalogQuery.error instanceof ApiError
                ? catalogQuery.error.message
                : "联系人公海目录暂时无法加载"
              : undefined
          }
          label="联系人公海目录"
        >
          <List<ContactPoolCatalogItem>
            className={styles.catalog}
            dataSource={[...(catalogQuery.data ?? [])]}
            grid={{ gutter: 16, xs: 1, sm: 2, lg: 3 }}
            loading={catalogQuery.isLoading}
            locale={{
              emptyText: (
                <Empty description="暂无可访问的联系人公海" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ),
            }}
            renderItem={(pool) => (
              <List.Item>
                <Card className={styles.card} title={pool.name}>
                  <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
                    <div className={styles.meta}>
                      <Tag color={statusColor(pool.status)}>{statusLabel(pool.status)}</Tag>
                      {pool.administrator ? <Tag color="blue">公海管理员</Tag> : <Tag>可访问</Tag>}
                    </div>
                    <Typography.Text type="secondary">
                      服务端当前统计：{pool.contactCount} 位联系人
                    </Typography.Text>
                    <Link to={`/crm/contact-pools/${pool.id}`}>查看联系人</Link>
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        </DataWorkspace>
      </main>
    </RouteAuthority>
  );
}
