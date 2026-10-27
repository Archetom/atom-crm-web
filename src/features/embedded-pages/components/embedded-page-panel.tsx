import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Empty, Space, Typography } from "antd";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import { embeddedPageKeys } from "../model/query-keys";

interface EmbeddedPagePanelProps {
  objectType: string;
  platform: string;
  recordId: number;
}

export function EmbeddedPagePanel({
  objectType,
  platform,
  recordId,
}: Readonly<EmbeddedPagePanelProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const identityKey = authState?.identityKey ?? "pending";
  const canRead = hasAuthority(authorization, authority.embeddedPagesRead);
  const pagesQuery = useQuery({
    queryKey: embeddedPageKeys.rendered(identityKey, objectType, recordId, platform),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("嵌入页面暂时不可用。"))
        : apiClient.getRenderedEmbeddedPages(objectType, recordId, platform),
    enabled: apiClient !== null && canRead,
  });

  if (!canRead) return null;

  return (
    <Card loading={pagesQuery.isLoading} title="嵌入页面">
      {pagesQuery.isError ? (
        <Alert
          title={
            pagesQuery.error instanceof ApiError ? pagesQuery.error.message : "嵌入页面暂时无法加载"
          }
          showIcon
          type="error"
        />
      ) : null}
      {pagesQuery.data?.length === 0 ? (
        <Empty description="暂无适用于当前记录的嵌入页面" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : null}
      <Space orientation="vertical" size="large" style={{ display: "flex" }}>
        {(pagesQuery.data ?? []).map((page) => (
          <section key={page.id} aria-label={page.name}>
            <Space orientation="vertical" size="small" style={{ display: "flex" }}>
              <Typography.Text strong>{page.name}</Typography.Text>
              {page.description ? (
                <Typography.Text type="secondary">{page.description}</Typography.Text>
              ) : null}
              <iframe
                loading="lazy"
                referrerPolicy="no-referrer"
                sandbox="allow-forms allow-popups allow-scripts"
                src={page.url}
                style={{ border: 0, minHeight: 480, width: "100%" }}
                title={page.name}
              />
            </Space>
          </section>
        ))}
      </Space>
    </Card>
  );
}
