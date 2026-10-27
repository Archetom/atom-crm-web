import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Empty, List, Space, Tag, Typography, message } from "antd";
import { useNavigate } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { findNavigationByRoute } from "~/app/navigation/navigation";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";

import { organizationKeys } from "../model/query-keys";
import { isGrantedTenantAccess, type TenantAccess } from "../model/tenant-access";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function tenantLabel(access: TenantAccess): string {
  return `租户 ${access.tenantId}`;
}

export function OrganizationTenantsPage() {
  const { adapter, state: authState } = useAuth();
  const { apiClient, authorization, navigation } = useBootstrap();
  const navigate = useNavigate();
  const actorId = authState?.actorId;
  const currentTenantId = authState?.tenantId;
  const identityKey = authState?.identityKey ?? "pending";
  const canSwitchDevelopmentTenant =
    authState?.mode === "development" &&
    typeof actorId === "number" &&
    typeof currentTenantId === "number" &&
    adapter?.replaceDevelopmentSession !== undefined;
  const tenantsQuery = useQuery({
    queryKey: organizationKeys.accessibleTenants(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Tenant access API is unavailable."))
        : apiClient.getAccessibleTenants(),
    enabled: apiClient !== null,
  });
  const switchMutation = useMutation({
    mutationFn: async (targetTenantId: number) => {
      if (apiClient === null || actorId === undefined) {
        throw new Error("Tenant switching is unavailable.");
      }
      const access = await apiClient.validateTenantAccess(targetTenantId);
      if (!isGrantedTenantAccess(access) || access.tenantId !== targetTenantId) {
        throw new Error("Tenant access is no longer granted.");
      }
      return access;
    },
    onSuccess: async (access) => {
      if (actorId === undefined || adapter?.replaceDevelopmentSession === undefined) return;
      await adapter.replaceDevelopmentSession({ actorId, tenantId: access.tenantId });
      window.location.assign("/");
    },
    onError: () => message.error("无法切换租户，请刷新后重试。"),
  });
  const accessibleTenants = (tenantsQuery.data ?? []).filter(isGrantedTenantAccess);
  const managementEntries = [
    {
      label: "部门管理",
      route: "/organization/departments",
    },
    {
      label: "成员管理",
      route: "/organization/members",
    },
    {
      label: "用户管理",
      route: "/administration/users",
    },
  ].flatMap((entry) => {
    const navigationEntry = findNavigationByRoute(navigation, entry.route);
    return navigationEntry !== undefined &&
      hasAuthority(authorization, navigationEntry.requiredAuthority)
      ? [entry]
      : [];
  });
  const canReviewMembershipRequests = hasAuthority(authorization, authority.organizationWrite);

  return (
    <RouteAuthority authority={authority.organizationRequest}>
      <main>
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <div>
            <Typography.Title level={2}>租户访问</Typography.Title>
            <Typography.Text type="secondary">
              仅展示服务端确认当前成员仍可访问的租户；租户身份、权限和数据范围不由浏览器推断。
            </Typography.Text>
            <div>
              <Button onClick={() => navigate("/organization/my-membership-requests")} type="link">
                查看我的成员申请
              </Button>
            </div>
          </div>
          {canSwitchDevelopmentTenant ? (
            <Alert
              description="每次切换都会重新验证成员资格，并仅替换当前浏览器标签页的开发会话。"
              title="开发租户切换"
              showIcon
              type="warning"
            />
          ) : (
            <Alert
              description="生产租户切换必须由认证服务签发新的受信凭据；CRM 不存储或构造租户身份。"
              title="租户身份由认证服务管理"
              showIcon
              type="info"
            />
          )}
          {tenantsQuery.isError ? (
            <Alert
              description={errorMessage(tenantsQuery.error, "请刷新后重试。")}
              title="租户访问目录暂时无法加载"
              showIcon
              type="error"
            />
          ) : null}
          <Card title="已授权租户">
            {accessibleTenants.length === 0 && !tenantsQuery.isLoading ? (
              <Empty description="暂无可访问租户" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                dataSource={accessibleTenants}
                loading={tenantsQuery.isLoading}
                renderItem={(access) => {
                  const isCurrent = access.tenantId === currentTenantId;
                  return (
                    <List.Item
                      actions={
                        canSwitchDevelopmentTenant
                          ? [
                              <Button
                                aria-label={`切换到租户 ${access.tenantId}`}
                                disabled={isCurrent || switchMutation.isPending}
                                key="switch"
                                loading={
                                  switchMutation.isPending &&
                                  switchMutation.variables === access.tenantId
                                }
                                onClick={() => switchMutation.mutate(access.tenantId)}
                                type={isCurrent ? "default" : "primary"}
                              >
                                {isCurrent ? "当前租户" : "切换"}
                              </Button>,
                            ]
                          : undefined
                      }
                    >
                      <List.Item.Meta
                        description={
                          access.departmentId === undefined || access.departmentId === null
                            ? "未关联部门"
                            : `部门 ${access.departmentId}`
                        }
                        title={
                          <Space size="small">
                            <Typography.Text strong>{tenantLabel(access)}</Typography.Text>
                            {isCurrent ? <Tag color="blue">当前</Tag> : null}
                            <Tag color="green">已授权</Tag>
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
                rowKey={(access) => access.tenantId}
              />
            )}
          </Card>
          {managementEntries.length > 0 || canReviewMembershipRequests ? (
            <Card title="租户管理">
              <Typography.Paragraph type="secondary">
                管理入口只来自服务端当前下发的导航与权限；租户身份本身仍由认证服务签发。
              </Typography.Paragraph>
              <Space wrap>
                {managementEntries.map((entry) => (
                  <Button key={entry.route} onClick={() => navigate(entry.route)}>
                    {entry.label}
                  </Button>
                ))}
                {canReviewMembershipRequests ? (
                  <Button onClick={() => navigate("/organization/membership-requests")}>
                    成员申请审批
                  </Button>
                ) : null}
              </Space>
            </Card>
          ) : null}
        </Space>
      </main>
    </RouteAuthority>
  );
}
