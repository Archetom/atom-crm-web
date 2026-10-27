import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  BellOutlined,
  HomeOutlined,
  MenuOutlined,
  PlusOutlined,
  ProfileOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Dropdown,
  Grid,
  Layout,
  Menu,
  Space,
  Tag,
  Tooltip,
  Typography,
  type MenuProps,
} from "antd";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { globalCreateActions } from "~/app/navigation/global-create";
import { flattenNavigation } from "~/app/navigation/navigation";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { ApprovalDefinitionListModal, ApprovalPendingModal } from "~/features/approvals";
import { approvalPendingKeys } from "~/features/approvals/model/approval-pending-query-keys";
import { NavigationPreferencesModal } from "~/features/navigation-preferences";
import { NotificationInboxModal, NotificationPreferencesModal } from "~/features/notifications";
import { MemberProfileModal, TenantSwitcher } from "~/features/organization";
import { translateTitleKey } from "~/shared/i18n/messages";
import type { NavigationItem } from "~/shared/types/api";

import {
  crmContextForPath,
  isCrmContextRoute,
  type CrmContextNavigation,
} from "./crm-context-navigation";
import styles from "./app-shell.module.css";

const { Header, Sider } = Layout;

function iconFor(code: string) {
  if (code.startsWith("workspace")) return <HomeOutlined />;
  if (code.startsWith("crm")) return <TeamOutlined />;
  if (code.startsWith("marketing")) return <AppstoreOutlined />;
  if (code.startsWith("organization")) return <ApartmentOutlined />;
  if (code.startsWith("administration")) return <SettingOutlined />;
  return <BankOutlined />;
}

function toMenuItems(
  items: NavigationItem[],
  authorities: string[],
  routes: Map<string, string>,
): MenuProps["items"] {
  return items
    .filter((item) => hasAuthority({ authorities }, item.requiredAuthority))
    .sort((left, right) => left.order - right.order)
    .map((item) => {
      const children = toMenuItems(item.children ?? [], authorities, routes);
      const key = item.route ?? `group:${item.code}`;
      if (item.route) routes.set(key, item.route);
      const label = translateTitleKey(item.titleKey, item.code);
      return children && children.length > 0
        ? { key, icon: iconFor(item.code), label, children }
        : { key, icon: iconFor(item.code), label };
    });
}

function toContextItems(
  navigation: NavigationItem[],
  authorities: string[],
  routes: Map<string, string>,
  context: CrmContextNavigation | null,
): MenuProps["items"] {
  if (context === null) return [];

  const contextEntries = flattenNavigation(navigation).filter(
    (item) =>
      item.route !== null &&
      context.routes.includes(item.route) &&
      hasAuthority({ authorities }, item.requiredAuthority),
  );
  return contextEntries.map((item) => {
    const key = item.route ?? item.code;
    if (item.route) routes.set(key, item.route);
    return { key, icon: iconFor(item.code), label: translateTitleKey(item.titleKey, item.code) };
  });
}

function topNavigationItems(
  navigation: NavigationItem[],
  authorities: string[],
  routes: Map<string, string>,
): MenuProps["items"] {
  return flattenNavigation(navigation)
    .filter(
      (item) =>
        item.route !== null &&
        !isCrmContextRoute(item.route) &&
        hasAuthority({ authorities }, item.requiredAuthority),
    )
    .sort((left, right) => left.order - right.order)
    .map((item) => {
      const key = item.route ?? item.code;
      if (item.route) routes.set(key, item.route);
      return { key, label: translateTitleKey(item.titleKey, item.code) };
    });
}

export function ResponsiveAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { apiClient, authorization, navigation } = useBootstrap();
  const { state: authState } = useAuth();
  const screens = Grid.useBreakpoint();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [approvalPendingOpen, setApprovalPendingOpen] = useState(false);
  const [approvalDefinitionsOpen, setApprovalDefinitionsOpen] = useState(false);
  const [notificationInboxOpen, setNotificationInboxOpen] = useState(false);
  const [notificationPreferencesOpen, setNotificationPreferencesOpen] = useState(false);
  const [navigationPreferencesOpen, setNavigationPreferencesOpen] = useState(false);
  const [memberProfileOpen, setMemberProfileOpen] = useState(false);

  const currentCrmContext = crmContextForPath(location.pathname);
  const { items, topItems, routes, contextItems, contextRoutes } = useMemo(() => {
    const routeMap = new Map<string, string>();
    const localRouteMap = new Map<string, string>();
    const authorities = authorization?.authorities ?? [];
    return {
      items: toMenuItems(navigation, authorities, routeMap),
      topItems: topNavigationItems(navigation, authorities, routeMap),
      routes: routeMap,
      contextItems: toContextItems(navigation, authorities, localRouteMap, currentCrmContext),
      contextRoutes: localRouteMap,
    };
  }, [authorization?.authorities, currentCrmContext, navigation]);
  const selectedKey = flattenNavigation(navigation).find(
    (item) => item.route === location.pathname,
  )?.route;
  const isMobile = !screens.md;
  const identityKey = authState?.identityKey ?? "pending";
  const canReadApprovals = hasAuthority(authorization, authority.approvalsRead);
  const approvalPendingCountQuery = useQuery({
    queryKey: approvalPendingKeys.count(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("审批待办数量暂时不可用。"))
        : apiClient.getApprovalPendingCount(),
    enabled: apiClient !== null && canReadApprovals,
    staleTime: Infinity,
  });
  const approvalPendingCount = approvalPendingCountQuery.data ?? 0;

  const utilityItems = [
    hasAuthority(authorization, authority.worklistRead)
      ? { key: "worklist", label: "查看我的待办" }
      : null,
    hasAuthority(authorization, authority.connectorsRead)
      ? { key: "connectors", label: "打开连接器" }
      : null,
    hasAuthority(authorization, authority.enterpriseDataRead)
      ? { key: "enterprise-data", label: "查看企业数据" }
      : null,
    hasAuthority(authorization, authority.navigationRead)
      ? { key: "navigation-preferences", label: "设置菜单" }
      : null,
    hasAuthority(authorization, authority.notificationsRead)
      ? { key: "notification-preferences", label: "设置通知" }
      : null,
    hasAuthority(authorization, authority.organizationRequest)
      ? { key: "member-profile", label: "更新我的资料" }
      : null,
  ].filter((item): item is { key: string; label: string } => item !== null);
  const createItems = globalCreateActions(navigation, authorization);
  const createMenuItems = createItems.map((item) => ({ key: item.key, label: item.label }));

  function handleMenuClick({ key }: { key: string }) {
    const route = routes.get(key) ?? contextRoutes.get(key);
    if (route) navigate(route);
    setMobileOpen(false);
  }

  function handleUtilityClick({ key }: { key: string }) {
    if (key === "worklist") navigate("/worklist");
    if (key === "connectors") navigate("/administration/connectors");
    if (key === "enterprise-data") navigate("/administration/enterprise-data");
    if (key === "navigation-preferences") setNavigationPreferencesOpen(true);
    if (key === "notification-preferences") setNotificationPreferencesOpen(true);
    if (key === "member-profile") setMemberProfileOpen(true);
  }

  const mainNavigation = (
    <Menu
      className={styles.moduleNavigation}
      mode="horizontal"
      items={topItems}
      selectedKeys={selectedKey ? [selectedKey] : []}
      onClick={handleMenuClick}
    />
  );

  return (
    <Layout className={styles.shell}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <Header className={styles.header}>
        <Space className={styles.headerLeading} size={4}>
          <Button
            aria-label="打开导航"
            className={styles.menuButton}
            icon={<MenuOutlined />}
            type="text"
            onClick={() => setMobileOpen(true)}
          />
          <Dropdown menu={{ items, onClick: handleMenuClick }} trigger={["click"]}>
            <Button
              aria-label="打开应用模块"
              className={styles.applicationEntry}
              icon={<AppstoreOutlined />}
              type="text"
            />
          </Dropdown>
          <div className={styles.brand}>
            <span aria-hidden="true" className={styles.brandMark}>
              A
            </span>
            <Typography.Text className={styles.applicationName}>CRM</Typography.Text>
          </div>
        </Space>
        <nav aria-label="主模块导航" className={styles.topNavigation}>
          {mainNavigation}
        </nav>
        <Space className={styles.headerActions} size={2}>
          {createItems.length > 0 ? (
            <Dropdown
              menu={{
                items: createMenuItems,
                onClick: ({ key }) => {
                  const action = createItems.find((item) => item.key === key);
                  if (action) navigate(action.to);
                },
              }}
              trigger={["click"]}
            >
              <Button
                aria-label="全局新建"
                className={styles.globalCreate}
                icon={<PlusOutlined />}
                type="primary"
              >
                新建
              </Button>
            </Dropdown>
          ) : null}
          {utilityItems.length > 0 ? (
            <Dropdown
              menu={{ items: utilityItems, onClick: handleUtilityClick }}
              trigger={["click"]}
            >
              <Tooltip title="工具与设置">
                <Button
                  aria-label="工具与设置"
                  className={styles.headerIconButton}
                  icon={<SettingOutlined />}
                  type="text"
                />
              </Tooltip>
            </Dropdown>
          ) : null}
          <ActionAuthority authority={authority.approvalsManage}>
            <Tooltip title="打开审批定义">
              <Button
                aria-label="打开审批定义"
                className={styles.headerIconButton}
                icon={<ProfileOutlined />}
                type="text"
                onClick={() => setApprovalDefinitionsOpen(true)}
              />
            </Tooltip>
          </ActionAuthority>
          <ActionAuthority authority={authority.approvalsRead}>
            <Badge count={approvalPendingCount} overflowCount={99} size="small">
              <Tooltip
                title={
                  approvalPendingCount > 0 ? `审批待办：${approvalPendingCount} 项` : "打开审批待办"
                }
              >
                <Button
                  aria-label={
                    approvalPendingCount > 0
                      ? `打开审批待办，当前 ${approvalPendingCount} 项`
                      : "打开审批待办"
                  }
                  className={styles.headerIconButton}
                  icon={<AuditOutlined />}
                  type="text"
                  onClick={() => setApprovalPendingOpen(true)}
                />
              </Tooltip>
            </Badge>
          </ActionAuthority>
          <ActionAuthority authority={authority.notificationsRead}>
            <ActionAuthority authority={authority.workTasksRead}>
              <Tooltip title="打开通知中心">
                <Button
                  aria-label="打开通知中心"
                  className={styles.headerIconButton}
                  icon={<BellOutlined />}
                  type="text"
                  onClick={() => setNotificationInboxOpen(true)}
                />
              </Tooltip>
            </ActionAuthority>
          </ActionAuthority>
          <TenantSwitcher className={styles.tenantSwitcher} />
          {authState?.mode === "development" ? <Tag color="blue">开发身份</Tag> : null}
          <Typography.Text className={styles.headerMeta}>
            {authState?.actorId ? `成员 ${authState.actorId}` : "当前成员"}
          </Typography.Text>
          <Tooltip title={authState?.actorId ? `当前成员 ${authState.actorId}` : "当前成员"}>
            <span
              aria-label={authState?.actorId ? `当前成员 ${authState.actorId}` : "当前成员"}
              role="img"
            >
              <Avatar aria-hidden="true" className={styles.memberAvatar} size="small">
                {authState?.actorId ? String(authState.actorId).slice(-2) : "CRM"}
              </Avatar>
            </span>
          </Tooltip>
        </Space>
      </Header>
      <Layout className={styles.inner}>
        {!isMobile && currentCrmContext !== null && contextItems && contextItems.length > 0 ? (
          <Sider className={styles.contextRail} theme="light" width={240}>
            <Typography.Text className={styles.contextTitle}>
              {currentCrmContext.title}
            </Typography.Text>
            <Menu
              className={styles.contextNavigation}
              items={contextItems}
              mode="inline"
              selectedKeys={selectedKey ? [selectedKey] : []}
              onClick={handleMenuClick}
            />
          </Sider>
        ) : null}
        <div className={styles.content}>
          <div className={styles.contentMain} id="main-content" tabIndex={-1}>
            {children}
          </div>
        </div>
      </Layout>
      <Drawer
        className={styles.drawer}
        open={mobileOpen}
        placement="left"
        size="min(84vw, 320px)"
        title="应用模块"
        onClose={() => setMobileOpen(false)}
      >
        <Menu
          className={styles.mobileNavigation}
          items={items}
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          onClick={handleMenuClick}
        />
      </Drawer>
      <NotificationPreferencesModal
        open={notificationPreferencesOpen}
        onClose={() => setNotificationPreferencesOpen(false)}
      />
      <NavigationPreferencesModal
        open={navigationPreferencesOpen}
        onClose={() => setNavigationPreferencesOpen(false)}
      />
      <MemberProfileModal open={memberProfileOpen} onClose={() => setMemberProfileOpen(false)} />
      <ApprovalPendingModal
        open={approvalPendingOpen}
        onClose={() => setApprovalPendingOpen(false)}
      />
      <ApprovalDefinitionListModal
        open={approvalDefinitionsOpen}
        onClose={() => setApprovalDefinitionsOpen(false)}
      />
      <NotificationInboxModal
        open={notificationInboxOpen}
        onClose={() => setNotificationInboxOpen(false)}
      />
    </Layout>
  );
}
