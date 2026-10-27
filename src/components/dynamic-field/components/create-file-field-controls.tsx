import { Button, Divider, Form, Input, Space, Typography } from "antd";

import type { components } from "~/api/generated/schema";

import { customFileFieldDefinitions } from "../model/custom-field-form";
import type { FieldDefinition } from "../model/field-definition";

export type CreateFileFieldFiles = Readonly<
  Record<string, readonly components["schemas"]["FileFieldUploadedFileResponse"][]>
>;

/** Uses the server-governed pre-create draft flow; file IDs never come from text inputs. */
export function CreateFileFieldControls({
  bindingObjectName,
  definitions,
  disabled,
  errors = {},
  filesByField,
  onRemove,
  onUpload,
  uploading,
}: Readonly<{
  bindingObjectName: string;
  definitions: readonly FieldDefinition[];
  disabled: boolean;
  errors?: Readonly<Record<string, string>>;
  filesByField: CreateFileFieldFiles;
  onRemove(fieldCode: string, fileId: number): void;
  onUpload(fieldCode: string, files: readonly File[]): void;
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
        return (
          <div key={definition.code}>
            {showSection ? (
              <Divider orientation="horizontal" plain titlePlacement="start">
                {section}
              </Divider>
            ) : null}
            <Form.Item
              extra={`文件会先通过服务端签发的上传意图完成校验，创建${bindingObjectName}时才会绑定。`}
              label={definition.displayName}
              required={definition.required}
              validateStatus={errors[definition.code] === undefined ? undefined : "error"}
            >
              <Input
                aria-label={definition.displayName}
                disabled={disabled || uploading}
                multiple
                type="file"
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = "";
                  if (files.length > 0) onUpload(definition.code, files);
                }}
              />
            </Form.Item>
            {files.length > 0 ? (
              <Space orientation="vertical" size="small">
                {files.map((file) => (
                  <Space key={file.fileId} wrap>
                    <Typography.Text>{file.displayName}</Typography.Text>
                    <Typography.Text type="secondary">
                      {file.status === "UPLOADED" ? "已上传" : "等待上传确认"}
                    </Typography.Text>
                    <Button
                      aria-label={`移除${definition.displayName}文件${file.displayName}`}
                      disabled={disabled || uploading}
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
            {errors[definition.code] === undefined ? null : (
              <Typography.Text role="alert" type="danger">
                {errors[definition.code]}
              </Typography.Text>
            )}
          </div>
        );
      })}
    </>
  );
}
