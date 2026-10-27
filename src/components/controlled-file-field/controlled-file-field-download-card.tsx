import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Card, List, Typography } from "antd";

import { saveControlledDownload } from "~/api/client/controlled-download";
import type { ControlledAttachmentTargetType } from "~/api/client/api-client";
import { ApiError } from "~/api/errors/api-error";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";

import {
  formatControlledFileFieldSize,
  type ControlledFileField,
  type ControlledFileFieldAttachment,
} from "./model";

interface FileFieldAttachmentItem extends ControlledFileFieldAttachment {
  fieldCode: string;
}

export function ControlledFileFieldDownloadCard({
  canRead,
  fileFields,
  targetId,
  targetType,
  title,
}: Readonly<{
  canRead: boolean;
  fileFields: readonly ControlledFileField[];
  targetId: number;
  targetType: ControlledAttachmentTargetType;
  title: string;
}>) {
  const { apiClient } = useBootstrap();
  const attachments: FileFieldAttachmentItem[] = fileFields.flatMap(({ attachments, fieldCode }) =>
    attachments.map((attachment) => ({ ...attachment, fieldCode })),
  );
  const downloadMutation = useMutation({
    mutationFn: ({ fieldCode, fileId }: Pick<FileFieldAttachmentItem, "fieldCode" | "fileId">) =>
      apiClient === null || !Number.isSafeInteger(targetId) || targetId <= 0
        ? Promise.reject(new Error("字段附件暂时无法下载。"))
        : apiClient.downloadFileField({ fieldCode, fileId, targetId, targetType }),
    onSuccess: (download) => saveControlledDownload(download),
  });

  if (!canRead || attachments.length === 0) return null;

  return (
    <Card title={title}>
      <Typography.Paragraph type="secondary">
        仅显示本次详情中服务端返回的 FILE 字段附件。字段名称未随响应下发时，界面保留服务端字段
        code，下载会通过认证请求再次由服务端校验。
      </Typography.Paragraph>
      {downloadMutation.isError ? (
        <Alert
          title={
            downloadMutation.error instanceof ApiError
              ? downloadMutation.error.message
              : "字段附件暂时无法下载"
          }
          showIcon
          type="error"
        />
      ) : null}
      <List
        dataSource={attachments}
        renderItem={(attachment) => (
          <List.Item
            actions={[
              <Button
                disabled={downloadMutation.isPending}
                key={`download-field-${attachment.fieldCode}-${attachment.fileId}`}
                loading={
                  downloadMutation.isPending &&
                  downloadMutation.variables?.fieldCode === attachment.fieldCode &&
                  downloadMutation.variables.fileId === attachment.fileId
                }
                type="link"
                onClick={() =>
                  downloadMutation.mutate({
                    fieldCode: attachment.fieldCode,
                    fileId: attachment.fileId,
                  })
                }
              >
                下载
              </Button>,
            ]}
          >
            <List.Item.Meta
              description={`${attachment.fieldCode} · ${attachment.mediaType ?? "媒体类型未提供"} · ${formatControlledFileFieldSize(attachment.actualBytes)}`}
              title={attachment.displayName}
            />
          </List.Item>
        )}
        rowKey={(attachment) => `${attachment.fieldCode}-${attachment.fileId}`}
      />
    </Card>
  );
}
