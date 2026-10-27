import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Result,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";

import { marketingKeys } from "../model/query-keys";
import {
  createPublicMarketingApiClient,
  type PublicMarketingFileDraft,
} from "../public-api-client";

type PublicForm = components["schemas"]["PublicMarketingFormResponse"];
type PublicField = components["schemas"]["MarketingFormFieldResponse"];

type PublicFormValues = Record<string, boolean | string | string[] | undefined>;
type UploadedFiles = Record<
  string,
  components["schemas"]["PublicMarketingFileUploadStatusResponse"][]
>;

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function idempotencyKey(): string {
  return crypto.randomUUID();
}

function hasValue(value: string[] | undefined): boolean {
  return value !== undefined && value.some((item) => item.trim().length > 0);
}

function valuesForSubmission(form: PublicForm, values: PublicFormValues): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const field of form.fields) {
    if (field.fieldType === "FILE") continue;
    const current = values[field.fieldCode];
    const fieldValues = Array.isArray(current)
      ? current.map((item) => item.trim()).filter(Boolean)
      : typeof current === "boolean"
        ? [String(current)]
        : typeof current === "string" && current.trim().length > 0
          ? [current.trim()]
          : [];
    if (field.required && !hasValue(fieldValues)) {
      throw new Error(`请填写${field.label}。`);
    }
    if (fieldValues.length > 0) result[field.fieldCode] = fieldValues;
  }
  return result;
}

function FieldInput({ field }: Readonly<{ field: PublicField }>) {
  if (field.fieldType === "FILE") return null;
  const required = field.required
    ? [{ required: true, message: `请填写${field.label}` }]
    : undefined;
  const label = (
    <Space size={4}>
      <span>{field.label}</span>
      {field.required ? <Typography.Text type="danger">*</Typography.Text> : null}
    </Space>
  );
  if (field.fieldType === "SELECT" || field.fieldType === "MULTI_SELECT") {
    return (
      <Form.Item label={label} name={field.fieldCode} rules={required} tooltip={field.helpText}>
        <Select
          mode={field.fieldType === "MULTI_SELECT" ? "multiple" : undefined}
          options={field.options.map((option) => ({ label: option.label, value: option.value }))}
          placeholder={field.placeholder}
        />
      </Form.Item>
    );
  }
  if (field.fieldType === "BOOLEAN") {
    return (
      <Form.Item
        initialValue={false}
        label={label}
        name={field.fieldCode}
        tooltip={field.helpText}
        valuePropName="checked"
      >
        <Checkbox>{field.placeholder ?? "是"}</Checkbox>
      </Form.Item>
    );
  }
  if (field.fieldType === "TEXTAREA") {
    return (
      <Form.Item label={label} name={field.fieldCode} rules={required} tooltip={field.helpText}>
        <Input.TextArea maxLength={4000} placeholder={field.placeholder} rows={4} />
      </Form.Item>
    );
  }
  const inputType =
    field.fieldType === "EMAIL"
      ? "email"
      : field.fieldType === "URL"
        ? "url"
        : field.fieldType === "INTEGER" || field.fieldType === "DECIMAL"
          ? "number"
          : field.fieldType === "DATE"
            ? "date"
            : field.fieldType === "DATETIME"
              ? "datetime-local"
              : "text";
  return (
    <Form.Item label={label} name={field.fieldCode} rules={required} tooltip={field.helpText}>
      <Input maxLength={1000} placeholder={field.placeholder} type={inputType} />
    </Form.Item>
  );
}

function FileField({
  error,
  field,
  files,
  onChange,
  uploading,
}: Readonly<{
  error: unknown;
  field: PublicField;
  files: readonly components["schemas"]["PublicMarketingFileUploadStatusResponse"][];
  onChange: (files: File[]) => void;
  uploading: boolean;
}>) {
  return (
    <Form.Item
      label={
        <Space size={4}>
          <span>{field.label}</span>
          {field.required ? <Typography.Text type="danger">*</Typography.Text> : null}
        </Space>
      }
      tooltip={field.helpText}
    >
      <Space orientation="vertical" style={{ display: "flex" }}>
        <Input
          disabled={uploading}
          multiple
          onChange={(event) => onChange(Array.from(event.target.files ?? []))}
          type="file"
        />
        {uploading ? <Spin size="small" /> : null}
        {files.map((file) => (
          <Typography.Text
            key={file.fileId}
            type={file.status === "UPLOADED" ? undefined : "danger"}
          >
            {file.displayName}（{file.status}）
          </Typography.Text>
        ))}
        {error ? (
          <Alert title={messageFor(error, "文件上传暂时失败")} showIcon type="error" />
        ) : null}
      </Space>
    </Form.Item>
  );
}

export function PublicMarketingFormPage() {
  const { publicId } = useParams();
  const apiClient = useMemo(() => createPublicMarketingApiClient(), []);
  const [form] = Form.useForm<PublicFormValues>();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({});
  const [hasDraft, setHasDraft] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const draftRef = useRef<PublicMarketingFileDraft | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const formQuery = useQuery({
    queryKey: marketingKeys.publicForm(publicId ?? "missing"),
    queryFn: () => {
      if (publicId === undefined || publicId.trim().length === 0) {
        return Promise.reject(new Error("公开表单标识无效。"));
      }
      return apiClient.getForm(publicId);
    },
    enabled: publicId !== undefined && publicId.trim().length > 0,
  });
  const uploadMutation = useMutation({
    mutationFn: async ({ fieldCode, files }: { fieldCode: string; files: File[] }) => {
      const publicForm = formQuery.data;
      if (publicForm === undefined || publicId === undefined) {
        throw new Error("公开表单暂时无法上传文件。");
      }
      const fileCodes = publicForm.fields
        .filter((field) => field.fieldType === "FILE")
        .map((field) => field.fieldCode);
      let draft = draftRef.current;
      if (draft === null || Date.parse(draft.expiresAt) <= Date.now()) {
        draft = await apiClient.createFileDraft(publicId, fileCodes);
        draftRef.current = draft;
        setHasDraft(true);
        setUploadedFiles({});
      }
      const filesUploaded = await apiClient.uploadFiles(publicId, draft, fieldCode, files);
      return { fieldCode, files: filesUploaded };
    },
    onSuccess: ({ fieldCode, files }) => {
      setUploadedFiles((current) => ({
        ...current,
        [fieldCode]: [...(current[fieldCode] ?? []), ...files],
      }));
    },
  });
  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (publicId === undefined || draftRef.current === null) return;
      await apiClient.withdrawFileDraft(publicId, draftRef.current);
    },
    onSuccess: () => {
      draftRef.current = null;
      setHasDraft(false);
      setUploadedFiles({});
    },
  });
  const submitMutation = useMutation({
    mutationFn: async (values: PublicFormValues) => {
      const publicForm = formQuery.data;
      if (publicForm === undefined || publicId === undefined)
        throw new Error("公开表单暂时无法提交。");
      const fileFields: Record<string, number[]> = {};
      for (const field of publicForm.fields.filter((item) => item.fieldType === "FILE")) {
        const files = uploadedFiles[field.fieldCode] ?? [];
        if (field.required && files.length === 0) throw new Error(`请上传${field.label}。`);
        if (files.some((file) => file.status !== "UPLOADED")) {
          throw new Error("请等待全部文件上传完成后再提交。");
        }
        if (files.length > 0) fileFields[field.fieldCode] = files.map((file) => file.fileId);
      }
      const draft = draftRef.current;
      if (Object.keys(fileFields).length > 0 && draft === null) {
        throw new Error("文件上传凭据已失效，请重新选择文件。");
      }
      const request: components["schemas"]["MarketingFormSubmissionRequest"] = {
        ...(draft === null ? {} : { fileDraftId: draft.draftId }),
        ...(Object.keys(fileFields).length === 0 ? {} : { fileFields }),
        idempotencyKey: idempotencyKeyRef.current ?? (idempotencyKeyRef.current = idempotencyKey()),
        values: valuesForSubmission(publicForm, values),
      };
      return apiClient.submit(publicId, request, draft?.uploadCapability);
    },
    onSuccess: () => {
      draftRef.current = null;
      setHasDraft(false);
      idempotencyKeyRef.current = null;
      setSubmitted(true);
      setUploadedFiles({});
    },
  });

  if (formQuery.isLoading) {
    return (
      <main style={{ display: "grid", minHeight: "100vh", placeItems: "center" }}>
        <Spin description="正在加载表单" />
      </main>
    );
  }
  if (formQuery.isError || formQuery.data === undefined) {
    return (
      <main style={{ margin: "0 auto", maxWidth: 680, padding: "48px 20px" }}>
        <Alert title={messageFor(formQuery.error, "公开表单暂时无法加载")} showIcon type="error" />
      </main>
    );
  }
  const publicForm = formQuery.data;
  if (submitted) {
    return (
      <main style={{ margin: "0 auto", maxWidth: 680, padding: "48px 20px" }}>
        <Result
          extra={
            <Button
              onClick={() => {
                form.resetFields();
                setSubmitted(false);
              }}
            >
              再次提交
            </Button>
          }
          status="success"
          subTitle={publicForm.successMessage ?? "我们已收到你的信息。"}
          title="提交成功"
        />
      </main>
    );
  }
  return (
    <main style={{ margin: "0 auto", maxWidth: 680, padding: "32px 20px 64px" }}>
      <Card>
        <Typography.Title level={2}>{publicForm.title}</Typography.Title>
        {publicForm.description ? (
          <Typography.Paragraph>{publicForm.description}</Typography.Paragraph>
        ) : null}
        <Form<PublicFormValues>
          form={form}
          layout="vertical"
          onFinish={(values) => submitMutation.mutate(values)}
        >
          {publicForm.fields.map((field) =>
            field.fieldType === "FILE" ? (
              <FileField
                error={uploadMutation.isError ? uploadMutation.error : null}
                field={field}
                files={uploadedFiles[field.fieldCode] ?? []}
                key={field.fieldCode}
                onChange={(files) => uploadMutation.mutate({ fieldCode: field.fieldCode, files })}
                uploading={uploadMutation.isPending}
              />
            ) : (
              <FieldInput field={field} key={field.fieldCode} />
            ),
          )}
          {submitMutation.isError ? (
            <Alert
              title={messageFor(submitMutation.error, "提交暂时失败，请稍后重试")}
              showIcon
              type="error"
            />
          ) : null}
          <Space style={{ marginTop: 12 }} wrap>
            <Button htmlType="submit" loading={submitMutation.isPending} type="primary">
              {publicForm.submitButtonText}
            </Button>
            {hasDraft ? (
              <Button
                loading={withdrawMutation.isPending}
                onClick={() => withdrawMutation.mutate()}
              >
                清空已上传文件
              </Button>
            ) : null}
          </Space>
        </Form>
      </Card>
    </main>
  );
}
