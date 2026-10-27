import { useQuery } from "@tanstack/react-query";
import { Button, Card, Empty, Space, Spin, Tag, Typography } from "antd";
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

import {
  decodeCustomerPoolCatalog,
  type CustomerPoolCatalogItem,
} from "../model/customer-pool-catalog";
import { customerPoolKeys } from "../model/query-keys";

import styles from "./customer-pool-catalog-page.module.css";

function statusLabel(status: CustomerPoolCatalogItem["status"]): string {
  if (status === "ACTIVE") return "启用";
  if (status === "INACTIVE") return "停用";
  return "已删除";
}

function statusColor(status: CustomerPoolCatalogItem["status"]): string | undefined {
  if (status === "ACTIVE") return "green";
  if (status === "INACTIVE") return "default";
  return "red";
}

export function CustomerPoolCatalogPage() {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const identityKey = authState?.identityKey ?? "pending";
  const catalogQuery = useQuery({
    queryKey: customerPoolKeys.catalog(identityKey),
    queryFn: async () => {
      if (apiClient === null) throw new Error("Customer pool catalog API is unavailable.");
      return decodeCustomerPoolCatalog(await apiClient.getCustomerPoolCatalog());
    },
    enabled: apiClient !== null,
  });

  return (
    <RouteAuthority authority={authority.customerPoolsRead}>
      <main>
        <PageHeader
          description="仅展示服务端确认当前成员可访问的公海；客户范围和后续操作仍由服务端逐项校验。"
          title="客户公海"
        />
        <FilterBar
          trailing={
            <ActionAuthority authority={authority.customerPoolsManage}>
              <Button type="primary" onClick={() => navigate("/crm/customer-pools/manage")}>
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
                : "客户公海目录暂时无法加载"
              : undefined
          }
          label="客户公海目录"
        >
          {catalogQuery.isLoading ? (
            <Spin description="正在加载客户公海目录" />
          ) : (catalogQuery.data ?? []).length === 0 ? (
            <Empty description="暂无可访问的客户公海" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div className={styles.catalog} role="list">
              {(catalogQuery.data ?? []).map((pool) => (
                <div key={pool.id} role="listitem">
                  <Card className={styles.card} title={pool.name}>
                    <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
                      <div className={styles.meta}>
                        <Tag color={statusColor(pool.status)}>{statusLabel(pool.status)}</Tag>
                        {pool.administrator ? (
                          <Tag color="blue">公海管理员</Tag>
                        ) : (
                          <Tag>可访问</Tag>
                        )}
                      </div>
                      <Typography.Text type="secondary">
                        服务端当前统计：{pool.customerCount} 位客户
                      </Typography.Text>
                      <Link to={`/crm/customer-pools/${pool.id}`}>查看客户</Link>
                    </Space>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </DataWorkspace>
      </main>
    </RouteAuthority>
  );
}
