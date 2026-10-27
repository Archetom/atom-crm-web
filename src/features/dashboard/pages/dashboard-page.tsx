import { Card, Empty, Typography } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { PageHeader } from "~/components/page/page-header";

import { DashboardPreferenceToolbar } from "../components/dashboard-preference-card";
import { DashboardDataSummary } from "../components/dashboard-data-summary";
import { DashboardCustomerContactReminder } from "../components/dashboard-customer-contact-reminder";
import { DashboardRankingPanel } from "../components/dashboard-ranking-panel";
import { DashboardSalesFunnel } from "../components/dashboard-sales-funnel";
import { DashboardSalesBrief } from "../components/dashboard-sales-brief";
import { DashboardTargetPanel } from "../components/dashboard-target-panel";
import { dashboardModules, withDashboardModuleVisibility } from "../model/dashboard-preference";
import { dashboardKeys } from "../model/query-keys";

import styles from "./dashboard-page.module.css";

export function DashboardPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const overviewQuery = useQuery({
    queryKey: dashboardKeys.overview(identityKey),
    queryFn: () =>
      apiClient?.getDashboardOverview() ?? Promise.reject(new Error("API client is unavailable.")),
    enabled: apiClient !== null,
  });
  const preferenceQuery = useQuery({
    queryKey: dashboardKeys.preference(identityKey),
    queryFn: () =>
      apiClient?.getDashboardPreference() ??
      Promise.reject(new Error("Dashboard preference API is unavailable.")),
    enabled: apiClient !== null,
  });
  const [preferenceAnnouncement, setPreferenceAnnouncement] = useState("");
  const closeReminderMutation = useMutation({
    mutationFn: () => {
      const preference = preferenceQuery.data;
      if (preference === undefined) {
        return Promise.reject(new Error("Dashboard preference is unavailable."));
      }
      return (
        apiClient?.updateDashboardPreference({
          timeRange: preference.timeRange,
          customStartDate:
            preference.timeRange === "CUSTOM" ? preference.customStartDate : undefined,
          customEndDate: preference.timeRange === "CUSTOM" ? preference.customEndDate : undefined,
          dataScope: preference.dataScope,
          hiddenModules: withDashboardModuleVisibility(
            preference.hiddenModules,
            dashboardModules.customerContactReminder,
            false,
          ),
          version: preference.version ?? undefined,
        }) ?? Promise.reject(new Error("Dashboard preference API is unavailable."))
      );
    },
    onSuccess: (preference) => {
      queryClient.setQueryData(dashboardKeys.preference(identityKey), preference);
      setPreferenceAnnouncement("已关闭客户遗忘提醒，可在工具栏中恢复显示。");
    },
  });
  const customerContactReminderHidden = preferenceQuery.data?.hiddenModules.includes(
    dashboardModules.customerContactReminder,
  );

  return (
    <RouteAuthority authority={authority.reportsRead}>
      <main className={styles.page}>
        <PageHeader title="CRM 仪表盘" />
        <DashboardPreferenceToolbar />
        <DashboardSalesBrief
          brief={overviewQuery.data?.salesBrief ?? []}
          isError={overviewQuery.isError}
          isLoading={overviewQuery.isLoading}
          onRetry={() => void overviewQuery.refetch()}
        />
        <section className={styles.businessModules} aria-label="业务模块">
          {overviewQuery.data === undefined ? (
            <Card className={styles.module} title="合同金额目标及完成情况">
              <Empty description="暂无可展示的目标数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          ) : (
            <DashboardTargetPanel
              className={styles.module}
              from={overviewQuery.data.from}
              target={overviewQuery.data.target}
              targetManagementPath={
                hasAuthority(authorization, authority.dashboardTargetsWrite)
                  ? "/administration/performance-targets"
                  : undefined
              }
              to={overviewQuery.data.to}
            />
          )}
          <DashboardSalesFunnel
            className={styles.module}
            from={overviewQuery.data?.from}
            funnel={overviewQuery.data?.salesFunnel}
            isError={overviewQuery.isError}
            isLoading={overviewQuery.isLoading}
            onRetry={() => void overviewQuery.refetch()}
            to={overviewQuery.data?.to}
          />
          {!customerContactReminderHidden ? (
            <DashboardCustomerContactReminder
              className={styles.module}
              closeError={closeReminderMutation.isError}
              isClosing={closeReminderMutation.isPending}
              isError={overviewQuery.isError}
              isLoading={overviewQuery.isLoading}
              preferredDataScope={overviewQuery.data?.preferredDataScope}
              reminder={overviewQuery.data?.customerContactReminder}
              onClose={
                preferenceQuery.data === undefined
                  ? undefined
                  : () => void closeReminderMutation.mutate()
              }
              onRetry={() => void overviewQuery.refetch()}
            />
          ) : null}
          <DashboardDataSummary
            isError={overviewQuery.isError}
            isLoading={overviewQuery.isLoading}
            summary={overviewQuery.data?.dataSummary ?? []}
            onRetry={() => void overviewQuery.refetch()}
          />
          {overviewQuery.data === undefined ? (
            <Card className={styles.module} title="排行榜">
              <Empty description="暂无可展示的业务排行" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          ) : (
            <DashboardRankingPanel
              from={overviewQuery.data.from}
              rankings={overviewQuery.data.rankings}
              to={overviewQuery.data.to}
            />
          )}
        </section>
        <Typography.Text aria-live="polite" className={styles.announcer} role="status">
          {preferenceAnnouncement}
        </Typography.Text>
      </main>
    </RouteAuthority>
  );
}
