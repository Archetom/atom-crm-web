import { SwapOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Dropdown, Tooltip, message, type MenuProps } from "antd";

import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import { organizationKeys } from "../model/query-keys";
import { isGrantedTenantAccess } from "../model/tenant-access";

interface TenantSwitcherProps {
  className?: string;
}

export function TenantSwitcher({ className }: Readonly<TenantSwitcherProps>) {
  const { adapter, state: authState } = useAuth();
  const { apiClient, authorization } = useBootstrap();
  const actorId = authState?.actorId;
  const tenantId = authState?.tenantId;
  const identityKey = authState?.identityKey ?? "pending";
  const canRequestMembership = hasAuthority(authorization, authority.organizationRequest);
  const enabled =
    authState?.mode === "development" &&
    typeof actorId === "number" &&
    typeof tenantId === "number" &&
    adapter?.replaceDevelopmentSession !== undefined &&
    apiClient !== null &&
    canRequestMembership;
  const tenantsQuery = useQuery({
    queryKey: organizationKeys.accessibleTenants(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("租户目录暂时不可用。"))
        : apiClient.getAccessibleTenants(),
    enabled,
  });
  const switchMutation = useMutation({
    mutationFn: async (targetTenantId: number) => {
      if (apiClient === null || actorId === undefined) {
        throw new Error("租户切换暂时不可用。");
      }
      const access = await apiClient.validateTenantAccess(targetTenantId);
      if (!isGrantedTenantAccess(access) || access.tenantId !== targetTenantId) {
        throw new Error("目标租户访问权限已经失效，请刷新后重试。");
      }
      return access;
    },
    onSuccess: async (access) => {
      if (actorId === undefined) return;
      if (adapter?.replaceDevelopmentSession === undefined) return;
      await adapter.replaceDevelopmentSession({ actorId, tenantId: access.tenantId });
      window.location.assign("/");
    },
    onError: () => {
      message.error("无法切换租户，请刷新后重试。");
    },
  });

  if (!enabled || tenantId === undefined) return null;

  const accessibleTenants = (tenantsQuery.data ?? []).filter(isGrantedTenantAccess);
  const items: MenuProps["items"] = accessibleTenants.map((access) => ({
    disabled: access.tenantId === tenantId || switchMutation.isPending,
    key: String(access.tenantId),
    label: access.departmentId
      ? `租户 ${access.tenantId} · 部门 ${access.departmentId}`
      : `租户 ${access.tenantId}`,
  }));
  const unavailable = tenantsQuery.isError || (tenantsQuery.isSuccess && items.length === 0);

  return (
    <Dropdown
      disabled={tenantsQuery.isLoading || unavailable || switchMutation.isPending}
      menu={{
        items,
        onClick: ({ key }) => {
          const targetTenantId = Number(key);
          if (
            Number.isSafeInteger(targetTenantId) &&
            targetTenantId > 0 &&
            targetTenantId !== tenantId
          ) {
            switchMutation.mutate(targetTenantId);
          }
        },
      }}
      trigger={["click"]}
    >
      <Tooltip title={unavailable ? "租户列表暂时无法加载" : "切换开发租户"}>
        <Button
          aria-label="切换开发租户"
          className={className}
          icon={<SwapOutlined />}
          loading={switchMutation.isPending || tenantsQuery.isLoading}
          type="text"
        >
          租户 {tenantId}
        </Button>
      </Tooltip>
    </Dropdown>
  );
}
