import { Card, Result, Tag, Typography } from "antd";
import { useLocation } from "react-router";

import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { findNavigationByRoute, phaseForRoute } from "~/app/navigation/navigation";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { StatusPage } from "~/components/feedback/status-page";
import { translateTitleKey } from "~/shared/i18n/messages";

export function ModulePlaceholderPage() {
  const { navigation } = useBootstrap();
  const location = useLocation();
  const item = findNavigationByRoute(navigation, location.pathname);

  if (!item) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={item.requiredAuthority}>
      <Card>
        <Result
          status="info"
          title={translateTitleKey(item.titleKey, item.code)}
          subTitle="该模块已由服务端菜单授权，但业务页面将在对应实施阶段交付。"
          extra={<Tag color="blue">计划阶段 {phaseForRoute(item.route ?? "/")}</Tag>}
        />
        <Typography.Paragraph type="secondary">
          当前页面保留稳定 URL，避免已授权菜单进入无效路由；不会加载或推断任何尚未实施的业务数据。
        </Typography.Paragraph>
      </Card>
    </RouteAuthority>
  );
}
