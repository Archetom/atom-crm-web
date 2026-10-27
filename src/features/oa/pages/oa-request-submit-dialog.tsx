import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Divider,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import type { ChangeEvent, UIEvent } from "react";
import { useState } from "react";

import type { components } from "~/api/generated/schema";
import type { ApiClient } from "~/api/client/api-client";
import { ApiError } from "~/api/errors/api-error";

import { oaKeys } from "../model/query-keys";

type OaForm = components["schemas"]["OaFormResponse"];
type OaFormField = components["schemas"]["OaFormFieldResponse"];
type OaFileDraft = components["schemas"]["FileFieldDraftResponse"];
type UploadedFile = components["schemas"]["FileFieldUploadedFileResponse"];

interface OaRequestDraft {
  formId?: number;
  selectedApprovers?: Record<string, string[]>;
  values?: Record<string, string[]>;
}

interface FileFieldState {
  [fieldCode: string]: UploadedFile[];
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function valuesOrEmpty(value: string[] | undefined): string[] {
  return value?.filter(Boolean) ?? [];
}

function scalarValue(value: unknown): string {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : "";
}

function scalarRules(field: OaFormField) {
  return field.required ? [{ required: true, message: `请填写${field.displayName}` }] : [];
}

function nextCandidatePage({
  pageNum,
  pageSize,
  totalNum,
}: {
  pageNum: number;
  pageSize: number;
  totalNum: number;
}): number | undefined {
  return pageNum * pageSize < totalNum ? pageNum + 1 : undefined;
}

function reachedPopupEnd(event: UIEvent<HTMLDivElement>): boolean {
  const target = event.currentTarget;
  return target.scrollTop + target.clientHeight >= target.scrollHeight - 24;
}

function CandidateField({
  apiClient,
  field,
  form,
  identityKey,
}: Readonly<{
  apiClient: ApiClient;
  field: OaFormField;
  form: OaForm;
  identityKey: string;
}>) {
  const [keyword, setKeyword] = useState("");
  const candidatesQuery = useInfiniteQuery({
    queryKey: oaKeys.formFieldCandidates(identityKey, form.id, field.fieldCode, keyword),
    queryFn: ({ pageParam }) =>
      apiClient.getOaFormFieldCandidates(form.id, field.fieldCode, {
        keyword: keyword || undefined,
        page: pageParam,
        size: 50,
      }),
    getNextPageParam: nextCandidatePage,
    initialPageParam: 1,
  });
  const options = candidatesQuery.data?.pages.flatMap((page) =>
    page.objectList.map((candidate) => ({
      label: candidate.displayName,
      value: String(candidate.id),
    })),
  );

  return (
    <Form.Item
      label={field.displayName}
      name={["values", field.fieldCode]}
      rules={scalarRules(field)}
    >
      <Select
        allowClear
        filterOption={false}
        loading={candidatesQuery.isLoading || candidatesQuery.isFetchingNextPage}
        mode="multiple"
        onPopupScroll={(event) => {
          if (reachedPopupEnd(event) && candidatesQuery.hasNextPage) {
            void candidatesQuery.fetchNextPage();
          }
        }}
        onSearch={setKeyword}
        options={options}
        placeholder="输入关键词搜索服务端允许的候选项"
        showSearch
      />
    </Form.Item>
  );
}

function ApprovalSelection({
  apiClient,
  form,
  identityKey,
  selection,
}: Readonly<{
  apiClient: ApiClient;
  form: OaForm;
  identityKey: string;
  selection: components["schemas"]["OaFormApprovalSelectionResponse"];
}>) {
  const [keyword, setKeyword] = useState("");
  const candidatesQuery = useInfiniteQuery({
    queryKey: oaKeys.approvalSelectionCandidates(identityKey, form.id, selection.code, keyword),
    queryFn: ({ pageParam }) =>
      apiClient.getOaFormApprovalSelectionCandidates(form.id, selection.code, {
        keyword: keyword || undefined,
        page: pageParam,
        size: 50,
      }),
    getNextPageParam: nextCandidatePage,
    initialPageParam: 1,
  });
  const options = candidatesQuery.data?.pages.flatMap((page) =>
    page.objectList.map((candidate) => ({
      label: candidate.displayName,
      value: String(candidate.actorId),
    })),
  );
  return (
    <Form.Item
      label={`${selection.name}（${selection.mode}）`}
      name={["selectedApprovers", selection.code]}
      rules={[{ required: true, message: `请选择${selection.name}` }]}
    >
      <Select
        allowClear
        filterOption={false}
        loading={candidatesQuery.isLoading || candidatesQuery.isFetchingNextPage}
        mode="multiple"
        onPopupScroll={(event) => {
          if (reachedPopupEnd(event) && candidatesQuery.hasNextPage) {
            void candidatesQuery.fetchNextPage();
          }
        }}
        onSearch={setKeyword}
        options={options}
        placeholder="输入关键词搜索服务端允许的审批人"
        showSearch
      />
    </Form.Item>
  );
}

function ScalarField({
  apiClient,
  field,
  form,
  identityKey,
}: Readonly<{
  apiClient: ApiClient;
  field: OaFormField;
  form: OaForm;
  identityKey: string;
}>) {
  if (field.fieldType === "USER" || field.fieldType === "DEPARTMENT") {
    return (
      <CandidateField apiClient={apiClient} field={field} form={form} identityKey={identityKey} />
    );
  }
  if (field.fieldType === "RELATION") {
    return (
      <Alert title={`${field.displayName} 暂无可提交的受治理关联值`} showIcon type="warning" />
    );
  }
  if (field.fieldType === "SELECT" || field.fieldType === "MULTI_SELECT") {
    return (
      <Form.Item
        label={field.displayName}
        name={["values", field.fieldCode]}
        rules={scalarRules(field)}
      >
        <Select
          allowClear
          mode={field.fieldType === "MULTI_SELECT" ? "multiple" : undefined}
          options={field.options.map((option) => ({ label: option.label, value: option.value }))}
          placeholder={`选择${field.displayName}`}
        />
      </Form.Item>
    );
  }
  if (field.fieldType === "BOOLEAN") {
    return (
      <Form.Item
        label={field.displayName}
        name={["values", field.fieldCode]}
        rules={scalarRules(field)}
      >
        <Select
          allowClear
          getPopupContainer={(node) => node.parentElement ?? document.body}
          options={[
            { label: "是", value: "true" },
            { label: "否", value: "false" },
          ]}
          placeholder={`选择${field.displayName}`}
        />
      </Form.Item>
    );
  }

  const inputType =
    field.fieldType === "DATE"
      ? "date"
      : field.fieldType === "DATETIME"
        ? "datetime-local"
        : field.fieldType === "EMAIL"
          ? "email"
          : field.fieldType === "PHONE"
            ? "tel"
            : field.fieldType === "URL"
              ? "url"
              : "text";
  const textarea = field.fieldType === "TEXTAREA" || field.fieldType === "ADDRESS";
  return (
    <Form.Item
      getValueProps={(value) => ({ value: scalarValue(value) })}
      label={field.displayName}
      name={["values", field.fieldCode]}
      normalize={(value: string) => (value.trim() ? [value.trim()] : [])}
      rules={scalarRules(field)}
    >
      {textarea ? <Input.TextArea maxLength={2000} rows={3} /> : <Input type={inputType} />}
    </Form.Item>
  );
}

function FileField({
  apiClient,
  draft,
  field,
  files,
  form,
  onFilesChanged,
}: Readonly<{
  apiClient: ApiClient;
  draft: OaFileDraft | null;
  field: OaFormField;
  files: UploadedFile[];
  form: OaForm;
  onFilesChanged: (draft: OaFileDraft, files: UploadedFile[]) => void;
}>) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const activeDraft = draft ?? (await apiClient.createOaFileFieldDraft(form.id, form.version));
      const result = await apiClient.uploadOaFileFieldFiles(activeDraft, field.fieldCode, selected);
      onFilesChanged(result.draft, result.files);
    } catch (caught) {
      setError(messageFor(caught, "OA 文件上传失败"));
    } finally {
      setUploading(false);
    }
  };
  const refreshStatus = async (file: UploadedFile) => {
    if (draft === null) return;
    setUploading(true);
    setError(null);
    try {
      const refreshed = await apiClient.getOaFileFieldUploadStatus(
        draft.id,
        field.fieldCode,
        file.fileId,
      );
      onFilesChanged(draft, [refreshed]);
    } catch (caught) {
      setError(messageFor(caught, "OA 文件状态暂时无法确认"));
    } finally {
      setUploading(false);
    }
  };
  return (
    <Form.Item label={field.displayName} required={field.required}>
      <Space orientation="vertical" style={{ display: "flex" }}>
        <input disabled={uploading} multiple onChange={onChange} type="file" />
        {uploading ? <Spin size="small" /> : null}
        {files.map((file) => (
          <Space key={file.fileId}>
            <Typography.Text type={file.status === "FAILED" ? "danger" : undefined}>
              {file.displayName}（{file.status}）
            </Typography.Text>
            {file.status === "PENDING" ? (
              <Button disabled={uploading} onClick={() => void refreshStatus(file)} size="small">
                刷新状态
              </Button>
            ) : null}
          </Space>
        ))}
        {error ? <Alert title={error} showIcon type="error" /> : null}
      </Space>
    </Form.Item>
  );
}

export function OaRequestSubmitDialog({
  apiClient,
  identityKey,
  onCancel,
  onSubmitted,
  open,
}: Readonly<{
  apiClient: ApiClient;
  identityKey: string;
  onCancel: () => void;
  onSubmitted: () => void;
  open: boolean;
}>) {
  const [form] = Form.useForm<OaRequestDraft>();
  const [fileDraft, setFileDraft] = useState<OaFileDraft | null>(null);
  const [fileFields, setFileFields] = useState<FileFieldState>({});
  const [preview, setPreview] = useState<components["schemas"]["OaRequestPreviewResponse"] | null>(
    null,
  );
  const selectedFormId = Form.useWatch("formId", form);
  const availableFormsQuery = useQuery({
    queryKey: oaKeys.availableForms(identityKey),
    queryFn: () => apiClient.getAvailableOaForms(),
    enabled: open,
  });
  const selectedFormQuery = useQuery({
    queryKey: oaKeys.availableForm(identityKey, selectedFormId ?? 0),
    queryFn: () =>
      selectedFormId === undefined
        ? Promise.reject(new Error("请选择当前可提交的 OA 表单。"))
        : apiClient.getAvailableOaForm(selectedFormId),
    enabled: open && selectedFormId !== undefined,
  });
  const selectedForm = selectedFormQuery.data;
  const fileIds = Object.fromEntries(
    Object.entries(fileFields).map(([fieldCode, files]) => [
      fieldCode,
      files.filter((file) => file.status === "UPLOADED").map((file) => file.fileId),
    ]),
  );
  const requestPayload = (draft: OaRequestDraft) => {
    if (selectedFormId === undefined) throw new Error("请选择当前可提交的 OA 表单。");
    if (selectedForm === undefined)
      throw new Error("OA 表单详情仍在加载或已不可提交，请重新选择。");
    if (
      Object.values(fileFields).some((files) => files.some((file) => file.status === "PENDING"))
    ) {
      throw new Error("文件仍在确认中，请刷新状态并等待上传完成后再提交。");
    }
    const missingFile = selectedForm.fields.some(
      (field) =>
        field.fieldType === "FILE" &&
        field.required &&
        (fileIds[field.fieldCode]?.length ?? 0) === 0,
    );
    if (missingFile) throw new Error("请先上传所有必填文件。");
    const selectedApprovers = Object.fromEntries(
      Object.entries(draft.selectedApprovers ?? {}).map(([code, actorIds]) => [
        code,
        valuesOrEmpty(actorIds).map((actorId) => Number(actorId)),
      ]),
    );
    return {
      fileFieldDraftId: fileDraft?.id,
      fileFields: fileIds,
      formId: selectedForm.id,
      formVersion: selectedForm.version,
      selectedApprovers,
      values: draft.values ?? {},
    };
  };
  const previewMutation = useMutation({
    mutationFn: (draft: OaRequestDraft) => apiClient.previewOaRequest(requestPayload(draft)),
    onSuccess: setPreview,
  });
  const submitMutation = useMutation({
    mutationFn: () => {
      const payload = requestPayload(form.getFieldsValue());
      return apiClient.submitOaRequest({ ...payload, idempotencyKey: crypto.randomUUID() });
    },
    onSuccess: () => {
      setFileDraft(null);
      setFileFields({});
      setPreview(null);
      form.resetFields();
      onSubmitted();
    },
  });
  const close = () => {
    if (fileDraft !== null) {
      void apiClient.withdrawFileFieldDraft(fileDraft.id, fileDraft.version).catch(() => undefined);
    }
    setFileDraft(null);
    setFileFields({});
    setPreview(null);
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={close}>取消</Button>
          {preview === null ? (
            <Button
              disabled={
                selectedFormId === undefined ||
                selectedFormQuery.isLoading ||
                selectedFormQuery.isError
              }
              loading={previewMutation.isPending}
              onClick={() => form.submit()}
              type="primary"
            >
              预览审批路线
            </Button>
          ) : (
            <Button
              disabled={selectedFormQuery.isLoading || selectedFormQuery.isError}
              loading={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              type="primary"
            >
              确认提交
            </Button>
          )}
        </Space>
      }
      onCancel={close}
      open={open}
      title="发起 OA 申请"
      width={720}
    >
      <Form<OaRequestDraft>
        form={form}
        layout="vertical"
        onFinish={(draft) => previewMutation.mutate(draft)}
        onValuesChange={(changed) => {
          if (changed.formId !== undefined) {
            setFileFields({});
            setPreview(null);
          }
          if (changed.values !== undefined || changed.selectedApprovers !== undefined)
            setPreview(null);
        }}
      >
        <Form.Item
          label="OA 表单"
          name="formId"
          rules={[{ required: true, message: "请选择 OA 表单" }]}
        >
          <Select
            loading={availableFormsQuery.isLoading}
            onChange={() => {
              if (fileDraft !== null) {
                void apiClient
                  .withdrawFileFieldDraft(fileDraft.id, fileDraft.version)
                  .catch(() => undefined);
              }
              setFileDraft(null);
              form.setFieldsValue({ selectedApprovers: {}, values: {} });
            }}
            options={availableFormsQuery.data?.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            placeholder="仅显示当前可提交的表单"
          />
        </Form.Item>
        {selectedForm ? (
          <>
            <Divider>填写申请内容</Divider>
            {selectedForm.fields.map((field) =>
              field.fieldType === "FILE" ? (
                <FileField
                  apiClient={apiClient}
                  draft={fileDraft}
                  field={field}
                  files={fileFields[field.fieldCode] ?? []}
                  form={selectedForm}
                  key={field.fieldCode}
                  onFilesChanged={(draft, files) => {
                    setFileDraft(draft);
                    setFileFields((current) => {
                      const replacing = new Map(files.map((file) => [file.fileId, file]));
                      return {
                        ...current,
                        [field.fieldCode]: [
                          ...(current[field.fieldCode] ?? []).filter(
                            (file) => !replacing.has(file.fileId),
                          ),
                          ...files,
                        ],
                      };
                    });
                    setPreview(null);
                  }}
                />
              ) : (
                <ScalarField
                  apiClient={apiClient}
                  field={field}
                  form={selectedForm}
                  identityKey={identityKey}
                  key={field.fieldCode}
                />
              ),
            )}
            {selectedForm.approvalSelections.length > 0 ? <Divider>选择审批人</Divider> : null}
            {selectedForm.approvalSelections.map((selection) => (
              <ApprovalSelection
                apiClient={apiClient}
                form={selectedForm}
                identityKey={identityKey}
                key={selection.code}
                selection={selection}
              />
            ))}
          </>
        ) : null}
        {selectedFormQuery.isLoading ? (
          <div
            aria-label="正在加载可提交 OA 表单详情"
            style={{ display: "grid", minHeight: 120, placeItems: "center" }}
          >
            <Spin size="small" />
          </div>
        ) : null}
        {selectedFormQuery.isError ? (
          <Alert
            title={messageFor(selectedFormQuery.error, "所选 OA 表单暂时不可用")}
            showIcon
            type="error"
          />
        ) : null}
      </Form>
      {previewMutation.isError ? (
        <Alert
          title={messageFor(previewMutation.error, "审批路线预览失败")}
          showIcon
          type="error"
        />
      ) : null}
      {submitMutation.isError ? (
        <Alert title={messageFor(submitMutation.error, "OA 申请提交失败")} showIcon type="error" />
      ) : null}
      {preview ? (
        <Space orientation="vertical" style={{ display: "flex" }}>
          <Divider>服务端审批路线</Divider>
          {preview.steps.length === 0 ? <Tag>自动通过</Tag> : null}
          {preview.steps.map((step, index) => (
            <Typography.Text key={step.code}>
              {(step.order ?? index) + 1}. {step.name}（{step.mode}）
            </Typography.Text>
          ))}
        </Space>
      ) : null}
    </Modal>
  );
}
