import { Button, Divider, Form, Input, Space, Typography } from "antd";

import { customFileFieldDefinitions } from "../model/custom-field-form";
import type { FieldDefinition } from "../model/field-definition";

export type EditableFileFieldStatus =
  "ACCEPTED_FOR_INSPECTION" | "AVAILABLE" | "BOUND" | "INDETERMINATE" | "REJECTED" | "UPLOADING";

export interface EditableFileFieldFile {
  displayName: string;
  fileId: number;
  status: EditableFileFieldStatus;
}

export type EditableFileFieldFiles = Readonly<Record<string, readonly EditableFileFieldFile[]>>;

function statusLabel(status: EditableFileFieldStatus): string {
  switch (status) {
    case "BOUND":
      return "已绑定";
    case "UPLOADING":
      return "正在上传";
    case "ACCEPTED_FOR_INSPECTION":
      return "正在安全检查";
    case "INDETERMINATE":
    case "AVAILABLE":
      return "检查通过，保存时绑定";
    case "REJECTED":
      return "未通过安全检查";
  }
}

/** Edits only FILE fields the current product detail and field catalog both safely expose. */
export function EditFileFieldControls({
  definitions,
  disabled,
  errors = {},
  filesByField,
  onRefresh,
  onRemove,
  onUpload,
  refreshingFileId,
  uploading,
}: Readonly<{
  definitions: readonly FieldDefinition[];
  disabled: boolean;
  errors?: Readonly<Record<string, string>>;
  filesByField: EditableFileFieldFiles;
  onRefresh(fieldCode: string, fileId: number): void;
  onRemove(fieldCode: string, fileId: number): void;
  onUpload(fieldCode: string, files: readonly File[]): void;
  refreshingFileId?: number;
  uploading: boolean;
}>) {
  const fields = customFileFieldDefinitions(definitions);
  if (fields.length === 0) return null;

  return (
    <>
      <Divider orientation="horizontal" titlePlacement="start">
        自定义文件
      </Divider>
      {fields.map((definition, index) => {
        const section = definition.sectionName ?? "未分组";
        const previousSection = fields[index - 1]?.sectionName ?? "未分组";
        const showSection = index === 0 || section !== previousSection;
        const files = filesByField[definition.code] ?? [];
        const limitReached = files.length >= 10;
        const inputId = `product-file-field-${definition.code}`;
        const error = errors[definition.code];
        const errorId = `${inputId}-error`;
        return (
          <div key={definition.code}>
            {showSection ? (
              <Divider orientation="horizontal" plain titlePlacement="start">
                {section}
              </Divider>
            ) : null}
            <Form.Item
              extra="新文件先在当前产品的私有候选中完成安全检查；保存后才替换此字段的绑定。"
              help={
                error === undefined ? undefined : (
                  <Typography.Text id={errorId} role="alert" type="danger">
                    {error}
                  </Typography.Text>
                )
              }
              label={definition.displayName}
              required={definition.required}
              validateStatus={error === undefined ? undefined : "error"}
            >
              <Input
                aria-label={definition.displayName}
                aria-describedby={error === undefined ? undefined : errorId}
                aria-invalid={error === undefined ? undefined : true}
                disabled={disabled || uploading || limitReached}
                id={inputId}
                multiple
                type="file"
                onChange={(event) => {
                  const selected = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = "";
                  if (selected.length > 0) onUpload(definition.code, selected);
                }}
              />
            </Form.Item>
            {files.length > 0 ? (
              <Space orientation="vertical" size="small">
                {files.map((file) => (
                  <Space key={file.fileId} wrap>
                    <Typography.Text>{file.displayName}</Typography.Text>
                    <Typography.Text type={file.status === "REJECTED" ? "danger" : "secondary"}>
                      {statusLabel(file.status)}
                    </Typography.Text>
                    {file.status === "BOUND" ? null : (
                      <Button
                        aria-label={`刷新${definition.displayName}文件${file.displayName}状态`}
                        disabled={disabled || uploading}
                        loading={refreshingFileId === file.fileId}
                        size="small"
                        type="link"
                        onClick={() => onRefresh(definition.code, file.fileId)}
                      >
                        刷新检查状态
                      </Button>
                    )}
                    <Button
                      aria-label={`移除${definition.displayName}文件${file.displayName}`}
                      disabled={disabled || uploading || refreshingFileId === file.fileId}
                      size="small"
                      type="link"
                      onClick={() => onRemove(definition.code, file.fileId)}
                    >
                      移除
                    </Button>
                  </Space>
                ))}
              </Space>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
