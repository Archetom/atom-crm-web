import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  List,
  Modal,
  Pagination,
  Popconfirm,
  Space,
  Spin,
  Typography,
  Upload,
} from "antd";
import { useState } from "react";

import { saveControlledDownload } from "~/api/client/controlled-download";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import {
  defaultPageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";

import { workTaskAttachmentKeys } from "../model/attachment-query-keys";
import { toWorkTaskAttachment, type WorkTaskAttachment } from "../model/work-task-attachment";

interface WorkTaskAttachmentsModalProps {
  taskId: number;
  open: boolean;
  onClose: () => void;
}

const attachmentPageSize = 20;

/**
 * Keeps only the published attachment projection in the query cache. Upload intent
 * state and inspection feedback are transient UI state and are never persisted.
 */
export function WorkTaskAttachmentsModal({
  taskId,
  open,
  onClose,
}: Readonly<WorkTaskAttachmentsModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadAttachments =
    hasAuthority(authorization, authority.workTasksRead) &&
    hasAuthority(authorization, authority.filesRead);
  const canWriteAttachments =
    hasAuthority(authorization, authority.workTasksWrite) &&
    hasAuthority(authorization, authority.filesWrite);
  const attachmentQuery = useQuery({
    queryKey: workTaskAttachmentKeys.list(identityKey, {
      page: currentPage,
      size: attachmentPageSize,
      taskId,
    }),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("任务附件暂时不可用。"))
        : apiClient.getWorkTaskAttachments(taskId, { page: currentPage, size: attachmentPageSize }),
    enabled: apiClient !== null && open && canReadAttachments,
  });
  const downloadMutation = useMutation({
    mutationFn: (fileId: number) =>
      apiClient === null
        ? Promise.reject(new Error("任务附件下载暂时不可用。"))
        : apiClient.downloadAttachment({ fileId, targetId: taskId, targetType: "work-task" }),
    onSuccess: (download) => saveControlledDownload(download),
  });
  const uploadMutation = useMutation({
    mutationFn: (files: readonly File[]) =>
      apiClient === null
        ? Promise.reject(new Error("任务附件暂时无法上传。"))
        : apiClient.uploadAttachments({ targetId: taskId, targetType: "work-task" }, files),
    onSuccess: (results) => {
      const statuses = results.map((result) => result.status.status);
      if (statuses.includes("REJECTED")) {
        setUploadFeedback("附件已提交，但有文件未通过安全检查。请重新选择文件后重试。");
      } else if (
        statuses.some((status) => status === "ACCEPTED_FOR_INSPECTION" || status === "UPLOADING")
      ) {
        setUploadFeedback("附件已提交，正在进行安全检查；通过后才会显示并可下载。");
      } else if (statuses.every((status) => status === "AVAILABLE")) {
        setUploadFeedback("附件已上传并可下载。");
      } else {
        setUploadFeedback("附件已提交，请稍后刷新附件列表查看状态。");
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: workTaskAttachmentKeys.lists(identityKey) });
    },
  });
  const withdrawMutation = useMutation({
    mutationFn: ({ fileId, version }: { fileId: number; version: number }) =>
      apiClient === null
        ? Promise.reject(new Error("任务附件暂时无法撤回。"))
        : apiClient.withdrawAttachment(
            { fileId, targetId: taskId, targetType: "work-task" },
            version,
          ),
    onSuccess: () => {
      setUploadFeedback("附件已撤回。");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: workTaskAttachmentKeys.lists(identityKey) });
    },
  });
  const attachmentPage: PageResult<WorkTaskAttachment> = attachmentQuery.data
    ? toPageResult(attachmentQuery.data, toWorkTaskAttachment)
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  function close() {
    if (downloadMutation.isPending || uploadMutation.isPending || withdrawMutation.isPending)
      return;
    downloadMutation.reset();
    uploadMutation.reset();
    withdrawMutation.reset();
    setUploadFeedback(null);
    onClose();
  }

  return (
    <Modal destroyOnHidden footer={null} open={open} title="任务附件" onCancel={close}>
      <Typography.Paragraph type="secondary">
        只显示服务端已授权、已发布附件的名称和可选媒体类型。上传依次创建受控意图、以认证
        `application/octet-stream`
        传输原始内容并读取检查状态；通过后才会显示并可下载。浏览器不保存上传能力、文件 ID
        或检查结果。
      </Typography.Paragraph>
      <Space wrap>
        {canWriteAttachments ? (
          <Upload
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            beforeUpload={(file) => {
              if (uploadMutation.isPending) return Upload.LIST_IGNORE;
              uploadMutation.mutate([file]);
              return Upload.LIST_IGNORE;
            }}
            disabled={uploadMutation.isPending}
            showUploadList={false}
          >
            <Button loading={uploadMutation.isPending} type="primary">
              上传任务附件
            </Button>
          </Upload>
        ) : null}
        {canReadAttachments ? (
          <Button
            disabled={attachmentQuery.isFetching}
            onClick={() => void attachmentQuery.refetch()}
          >
            刷新
          </Button>
        ) : null}
      </Space>
      {!canReadAttachments && canWriteAttachments ? (
        <Alert
          title="当前身份没有附件读取权限；可提交附件，但无法查看或下载已发布文件。"
          showIcon
          style={{ marginTop: 12 }}
          type="info"
        />
      ) : null}
      {attachmentQuery.isLoading ? <Spin /> : null}
      {attachmentQuery.isError ? (
        <Alert
          title={
            attachmentQuery.error instanceof ApiError
              ? attachmentQuery.error.message
              : "任务附件暂时无法加载"
          }
          showIcon
          type="error"
        />
      ) : null}
      {downloadMutation.isError ? (
        <Alert
          title={
            downloadMutation.error instanceof ApiError
              ? downloadMutation.error.message
              : "任务附件暂时无法下载"
          }
          showIcon
          style={{ marginTop: 12 }}
          type="error"
        />
      ) : null}
      {uploadMutation.isError ? (
        <Alert
          title={
            uploadMutation.error instanceof ApiError
              ? uploadMutation.error.message
              : "任务附件暂时无法上传"
          }
          showIcon
          style={{ marginTop: 12 }}
          type="error"
        />
      ) : null}
      {withdrawMutation.isError ? (
        <Alert
          title={
            withdrawMutation.error instanceof ApiError
              ? withdrawMutation.error.message
              : "任务附件暂时无法撤回"
          }
          showIcon
          style={{ marginTop: 12 }}
          type="error"
        />
      ) : null}
      {uploadFeedback !== null ? (
        <Alert title={uploadFeedback} showIcon style={{ marginTop: 12 }} type="info" />
      ) : null}
      {canReadAttachments ? (
        <>
          <List<WorkTaskAttachment>
            dataSource={attachmentPage.items}
            loading={attachmentQuery.isFetching && !attachmentQuery.isLoading}
            locale={{ emptyText: attachmentQuery.isLoading ? "" : "暂无可下载附件" }}
            renderItem={(attachment) => (
              <List.Item
                actions={[
                  <Button
                    disabled={downloadMutation.isPending}
                    key={`download-${attachment.fileId}`}
                    loading={
                      downloadMutation.isPending && downloadMutation.variables === attachment.fileId
                    }
                    type="link"
                    onClick={() => downloadMutation.mutate(attachment.fileId)}
                  >
                    下载
                  </Button>,
                  ...(canWriteAttachments
                    ? [
                        <Popconfirm
                          cancelText="取消"
                          key={`withdraw-${attachment.fileId}`}
                          okButtonProps={{ danger: true }}
                          okText="撤回"
                          title="确认撤回此任务附件？"
                          onConfirm={() =>
                            withdrawMutation.mutate({
                              fileId: attachment.fileId,
                              version: attachment.version,
                            })
                          }
                        >
                          <Button
                            danger
                            disabled={withdrawMutation.isPending}
                            loading={
                              withdrawMutation.isPending &&
                              withdrawMutation.variables?.fileId === attachment.fileId
                            }
                            type="link"
                          >
                            撤回
                          </Button>
                        </Popconfirm>,
                      ]
                    : []),
                ]}
              >
                <List.Item.Meta
                  description={attachment.mediaType ?? "媒体类型未提供"}
                  title={attachment.displayName}
                />
              </List.Item>
            )}
          />
          {attachmentPage.total !== null && attachmentPage.total > attachmentPageSize ? (
            <Space style={{ marginTop: 12 }}>
              <Pagination
                current={currentPage}
                pageSize={attachmentPageSize}
                showSizeChanger={false}
                total={attachmentPage.total}
                onChange={(page) => setCurrentPage(page)}
              />
            </Space>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
