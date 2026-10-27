import { Button, Result } from "antd";
import { useNavigate } from "react-router";

import type { StatusKind } from "./status-kind";

const statusContent: Record<
  StatusKind,
  {
    status: 403 | 404 | 500 | "success" | "error" | "info" | "warning";
    title: string;
    detail: string;
  }
> = {
  unauthorized: {
    status: "info",
    title: "登录状态已失效",
    detail: "请通过你的组织登录入口重新验证身份。",
  },
  forbidden: {
    status: 403,
    title: "暂无访问权限",
    detail: "你没有查看此页面或执行该操作的权限。",
  },
  "not-found": {
    status: 404,
    title: "页面不存在",
    detail: "页面可能已移动，或你没有查看该资源的权限。",
  },
  conflict: {
    status: "warning",
    title: "数据已发生变化",
    detail: "请刷新数据后再继续操作，系统不会覆盖其他成员的更新。",
  },
  "duplicate-resource": {
    status: "warning",
    title: "相同资源已存在",
    detail: "请检查已有记录后再提交，系统没有重复创建资源。",
  },
  unavailable: {
    status: 500,
    title: "服务暂时不可用",
    detail: "请稍后重试；如问题持续，请联系系统管理员。",
  },
};

export function StatusPage({
  kind,
  onRetry,
}: Readonly<{ kind: StatusKind; onRetry?: () => void }>) {
  const navigate = useNavigate();
  const content = statusContent[kind];

  return (
    <Result
      status={content.status}
      title={content.title}
      subTitle={content.detail}
      extra={
        onRetry ? (
          <Button type="primary" onClick={onRetry}>
            重试
          </Button>
        ) : (
          <Button type="primary" onClick={() => navigate("/")}>
            返回工作台
          </Button>
        )
      }
    />
  );
}
