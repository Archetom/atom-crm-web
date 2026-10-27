import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Drawer, List, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { saveControlledDownload } from "~/api/client/controlled-download";
import type { OaRequestFileFieldDownloadRequest } from "~/api/client/api-client";
import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  decodeControlledFileFields,
  formatControlledFileFieldSize,
} from "~/components/controlled-file-field";
import {
  defaultPageRequest,
  normalizePageRequest,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";

import { oaKeys } from "../model/query-keys";

import { OaRequestSubmitDialog } from "./oa-request-submit-dialog";

type OaRequest = components["schemas"]["OaRequestResponse"];

function toPageResult(
  response: components["schemas"]["OaRequestPageResponse"],
): PageResult<OaRequest> {
  return {
    page: response.pageNum,
    size: response.pageSize,
    total: response.totalNum,
    items: response.objectList,
    meta: {},
  };
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "OA 申请暂时无法加载";
}

function updateSearch(current: URLSearchParams, page: number, size: number): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set("page", String(page));
  next.set("size", String(size));
  return next;
}

function displayValue(value: string[] | undefined): string {
  return value?.filter(Boolean).join("、") || "—";
}

export function OaRequestsPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<OaRequest | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const search = searchParams.toString();
  const canReadFiles = hasAuthority(authorization, authority.filesRead);
  const request = useMemo(() => {
    const params = new URLSearchParams(search);
    return normalizePageRequest({
      page: Number.parseInt(params.get("page") ?? "", 10),
      size: Number.parseInt(params.get("size") ?? "", 10),
    });
  }, [search]);
  const identityKey = authState?.identityKey ?? "pending";
  const requestsQuery = useQuery({
    queryKey: oaKeys.requests(identityKey, request.page, request.size),
    queryFn: () =>
      apiClient?.getOaRequests(request) ?? Promise.reject(new Error("OA 申请暂时不可用。")),
    enabled: apiClient !== null,
  });
  const detailQuery = useQuery({
    queryKey: [...oaKeys.all, "request", identityKey, selected?.id] as const,
    queryFn: () => {
      if (apiClient === null || selected === null) {
        return Promise.reject(new Error("OA 申请详情暂时不可用。"));
      }
      return apiClient.getOaRequest(selected.id);
    },
    enabled: apiClient !== null && selected !== null,
  });
  const fileDownloadMutation = useMutation({
    mutationFn: (request: OaRequestFileFieldDownloadRequest) =>
      apiClient === null
        ? Promise.reject(new Error("OA 文件暂时无法下载。"))
        : apiClient.downloadOaRequestFileField(request),
    onSuccess: (download) => saveControlledDownload(download),
  });
  const page: PageResult<OaRequest> = requestsQuery.data
    ? toPageResult(requestsQuery.data)
    : { ...defaultPageRequest, items: [], meta: {}, total: null };
  const columns: ColumnsType<OaRequest> = [
    { dataIndex: "id", key: "id", title: "申请编号" },
    {
      dataIndex: "approvalStatus",
      key: "approvalStatus",
      title: "审批状态",
      render: (value) => <Tag>{value}</Tag>,
    },
    { dataIndex: "formVersion", key: "formVersion", title: "表单版本" },
    {
      key: "actions",
      title: "操作",
      render: (_, item) => (
        <Button onClick={() => setSelected(item)} size="small">
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <RouteAuthority authority={authority.oaRequestsRead}>
      <main>
        <Typography.Title level={2}>OA 申请</Typography.Title>
        <Typography.Paragraph type="secondary">
          申请详情与字段值始终由服务端按当前可见性和脱敏策略返回；发起申请将使用表单作用域候选、路由预览和文件草稿流程。
        </Typography.Paragraph>
        <ActionAuthority authority={authority.oaRequestsSubmit}>
          <Button onClick={() => setSubmitOpen(true)} type="primary">
            发起 OA 申请
          </Button>
        </ActionAuthority>
        {requestsQuery.isError ? (
          <Alert title={errorMessage(requestsQuery.error)} showIcon type="error" />
        ) : null}
        <ResponsiveDataList
          columns={columns}
          loading={requestsQuery.isLoading}
          onPageChange={(pageNumber, pageSize) =>
            setSearchParams(updateSearch(searchParams, pageNumber, pageSize))
          }
          page={page}
          renderMobileItem={(item) => (
            <Space orientation="vertical" size="small" style={{ display: "flex" }}>
              <Typography.Text strong>申请 #{item.id}</Typography.Text>
              <Tag>{item.approvalStatus}</Tag>
              <Typography.Text type="secondary">表单版本 {item.formVersion}</Typography.Text>
            </Space>
          )}
          rowKey={(item) => item.id}
        />
      </main>
      <Drawer
        destroyOnHidden
        onClose={() => {
          fileDownloadMutation.reset();
          setSelected(null);
        }}
        open={selected !== null}
        title="OA 申请详情"
        width={520}
      >
        {detailQuery.isError ? (
          <Alert title={errorMessage(detailQuery.error)} showIcon type="error" />
        ) : null}
        {detailQuery.data ? (
          <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
            <Typography.Text>
              审批状态：<Tag>{detailQuery.data.approvalStatus}</Tag>
            </Typography.Text>
            <Typography.Text>表单版本：{detailQuery.data.formVersion}</Typography.Text>
            {Object.entries(detailQuery.data.values).map(([fieldCode, value]) => (
              <div key={fieldCode}>
                <Typography.Text type="secondary">{fieldCode}</Typography.Text>
                <br />
                <Typography.Text>{displayValue(value)}</Typography.Text>
              </div>
            ))}
            {canReadFiles && selected !== null ? (
              <>
                {fileDownloadMutation.isError ? (
                  <Alert
                    title={
                      fileDownloadMutation.error instanceof ApiError
                        ? fileDownloadMutation.error.message
                        : "OA 文件暂时无法下载"
                    }
                    showIcon
                    type="error"
                  />
                ) : null}
                {decodeControlledFileFields(detailQuery.data.fileFields).map((field) => (
                  <div key={field.fieldCode}>
                    <Typography.Text type="secondary">文件字段：{field.fieldCode}</Typography.Text>
                    <List
                      dataSource={[...field.attachments]}
                      renderItem={(attachment) => (
                        <List.Item
                          actions={[
                            <Button
                              disabled={fileDownloadMutation.isPending}
                              key={`download-${field.fieldCode}-${attachment.fileId}`}
                              loading={
                                fileDownloadMutation.isPending &&
                                fileDownloadMutation.variables?.fieldCode === field.fieldCode &&
                                fileDownloadMutation.variables.fileId === attachment.fileId
                              }
                              type="link"
                              onClick={() =>
                                fileDownloadMutation.mutate({
                                  fieldCode: field.fieldCode,
                                  fileId: attachment.fileId,
                                  requestId: selected.id,
                                })
                              }
                            >
                              下载
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            description={`${attachment.mediaType ?? "媒体类型未提供"} · ${formatControlledFileFieldSize(attachment.actualBytes)}`}
                            title={attachment.displayName}
                          />
                        </List.Item>
                      )}
                      rowKey={(attachment) => `${field.fieldCode}-${attachment.fileId}`}
                    />
                  </div>
                ))}
              </>
            ) : null}
          </Space>
        ) : null}
      </Drawer>
      {apiClient ? (
        <OaRequestSubmitDialog
          apiClient={apiClient}
          identityKey={identityKey}
          onCancel={() => setSubmitOpen(false)}
          onSubmitted={() => {
            setSubmitOpen(false);
            void requestsQuery.refetch();
          }}
          open={submitOpen}
        />
      ) : null}
    </RouteAuthority>
  );
}
