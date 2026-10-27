import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  List,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Typography,
} from "antd";
import { useState, type ReactNode } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";

import { stageWorkflowRuntimeKeys } from "../model/stage-workflow-runtime-query-keys";
import {
  type StageWorkflowAdvanceSelection,
  type StageWorkflowAdvanceField,
  type StageWorkflowAdvanceTask,
  type StageWorkflowAddressField,
  type StageWorkflowAddressPartCode,
  type StageWorkflowAddressValue,
  type StageWorkflowCandidateField,
  type StageWorkflowFileDraft,
  type StageWorkflowFileField,
  type StageWorkflowUploadedFile,
} from "../model/stage-workflow-runtime";

interface StageWorkflowAdvanceCardProps {
  addressFields: readonly StageWorkflowAddressField[];
  candidateFields: readonly StageWorkflowCandidateField[];
  fields: readonly StageWorkflowAdvanceField[];
  fileFields: readonly StageWorkflowFileField[];
  onRefresh: () => void;
  selections: readonly StageWorkflowAdvanceSelection[];
  tasks: readonly StageWorkflowAdvanceTask[];
  version: number;
  workflowRecordId: number;
}

const candidatePageSize = 50;

type StageWorkflowAddressDraft = Record<StageWorkflowAddressPartCode, string>;

interface StageWorkflowFileUpload {
  draft: StageWorkflowFileDraft;
  files: StageWorkflowUploadedFile[];
}

function selectedApproverMap(
  selections: readonly StageWorkflowAdvanceSelection[],
  selectedApprovers: Readonly<Record<string, readonly number[]>>,
): Record<string, number[]> {
  return Object.fromEntries(
    selections.map((selection) => [
      selection.code,
      [...new Set(selectedApprovers[selection.code] ?? [])].sort((left, right) => left - right),
    ]),
  );
}

function initialFieldValues(
  fields: readonly StageWorkflowAdvanceField[],
): Record<string, readonly string[]> {
  return Object.fromEntries(fields.map((field) => [field.fieldCode, field.currentValues]));
}

function initialAddressDraft(field: StageWorkflowAddressField): StageWorkflowAddressDraft {
  return {
    addressLine: field.currentAddress?.addressLine ?? "",
    city: field.currentAddress?.city ?? "",
    country: field.currentAddress?.country ?? "",
    latitude:
      field.currentAddress?.latitude === undefined ? "" : String(field.currentAddress.latitude),
    longitude:
      field.currentAddress?.longitude === undefined ? "" : String(field.currentAddress.longitude),
    postalCode: field.currentAddress?.postalCode ?? "",
    region: field.currentAddress?.region ?? "",
  };
}

function initialAddressValues(
  fields: readonly StageWorkflowAddressField[],
): Record<string, StageWorkflowAddressDraft> {
  return Object.fromEntries(
    fields.map((field) => [field.fieldCode, initialAddressDraft(field)]),
  ) as Record<string, StageWorkflowAddressDraft>;
}

function isAddressDraftEmpty(
  field: StageWorkflowAddressField,
  draft: StageWorkflowAddressDraft,
): boolean {
  return field.parts.every((part) => draft[part.code].trim().length === 0);
}

function toAddressValue(
  field: StageWorkflowAddressField,
  draft: StageWorkflowAddressDraft,
): StageWorkflowAddressValue | null {
  if (isAddressDraftEmpty(field, draft)) return null;
  const addressLine = draft.addressLine.trim();
  if (addressLine.length === 0) return null;
  const address: StageWorkflowAddressValue = { addressLine };
  for (const part of field.parts) {
    const value = draft[part.code].trim();
    if (value.length > part.maxLength || (part.required && value.length === 0)) return null;
    if (value.length === 0 || part.code === "addressLine") continue;
    if (part.code === "longitude" || part.code === "latitude") {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return null;
      address[part.code] = numeric;
    } else {
      address[part.code] = value;
    }
  }
  return address;
}

function addressFieldValueMap(
  fields: readonly StageWorkflowAddressField[],
  values: Readonly<Record<string, StageWorkflowAddressDraft>>,
): Record<string, StageWorkflowAddressValue> {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = toAddressValue(field, values[field.fieldCode] ?? initialAddressDraft(field));
      return value === null ? [] : [[field.fieldCode, value]];
    }),
  );
}

function normalizedFieldValues(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function fieldValueMap(
  fields: readonly StageWorkflowAdvanceField[],
  values: Readonly<Record<string, readonly string[]>>,
): Record<string, string[]> {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const fieldValues = normalizedFieldValues(values[field.fieldCode] ?? []);
      return fieldValues.length === 0 ? [] : [[field.fieldCode, fieldValues]];
    }),
  );
}

function inputType(field: StageWorkflowAdvanceField): string {
  switch (field.fieldType) {
    case "DATE":
      return "date";
    case "DATETIME":
      return "datetime-local";
    case "DECIMAL":
    case "INTEGER":
      return "number";
    case "EMAIL":
      return "email";
    case "PHONE":
      return "tel";
    case "URL":
      return "url";
    default:
      return "text";
  }
}

function candidateFieldMaps(
  fields: readonly StageWorkflowCandidateField[],
  selected: Readonly<Record<string, readonly number[]>>,
) {
  const maps = {
    actorFieldValues: {} as Record<string, number[]>,
    departmentFieldValues: {} as Record<string, number[]>,
    relationFieldValues: {} as Record<string, number[]>,
  };
  for (const field of fields) {
    const values = [...new Set(selected[field.fieldCode] ?? [])].sort(
      (left, right) => left - right,
    );
    if (values.length === 0) continue;
    if (field.fieldType === "USER") maps.actorFieldValues[field.fieldCode] = values;
    else if (field.fieldType === "DEPARTMENT") maps.departmentFieldValues[field.fieldCode] = values;
    else maps.relationFieldValues[field.fieldCode] = values;
  }
  return maps;
}

/** Advances only a server-confirmed stage whose remaining inputs are approved actor selections. */
export function StageWorkflowAdvanceCard({
  addressFields,
  candidateFields,
  fields,
  fileFields,
  onRefresh,
  selections,
  tasks,
  version,
  workflowRecordId,
}: Readonly<StageWorkflowAdvanceCardProps>) {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const [selectedApprovers, setSelectedApprovers] = useState<
    Readonly<Record<string, readonly number[]>>
  >({});
  const [completedTaskCodes, setCompletedTaskCodes] = useState<readonly string[]>([]);
  const [fieldValues, setFieldValues] = useState<Readonly<Record<string, readonly string[]>>>(() =>
    initialFieldValues(fields),
  );
  const [addressValues, setAddressValues] = useState<
    Readonly<Record<string, StageWorkflowAddressDraft>>
  >(() => initialAddressValues(addressFields));
  const [candidateFieldValues, setCandidateFieldValues] = useState<
    Readonly<Record<string, readonly number[]>>
  >(() => Object.fromEntries(candidateFields.map((field) => [field.fieldCode, field.currentIds])));
  const [fileUpload, setFileUpload] = useState<StageWorkflowFileUpload | null>(null);
  const [candidatePages, setCandidatePages] = useState<Readonly<Record<string, number>>>({});
  const candidateQueries = useQueries({
    queries: selections.map((selection) => {
      const page = candidatePages[selection.code] ?? 1;
      return {
        enabled: apiClient !== null,
        queryFn: () =>
          apiClient === null
            ? Promise.reject(new Error("阶段审批人候选暂时不可用。"))
            : apiClient.getStageWorkflowAdvanceSelectionCandidates(
                workflowRecordId,
                selection.code,
                { page, size: candidatePageSize },
              ),
        queryKey: stageWorkflowRuntimeKeys.advanceCandidatePage(
          identityKey,
          workflowRecordId,
          version,
          selection.code,
          page,
          candidatePageSize,
        ),
      };
    }),
  });
  const fieldCandidateQueries = useQueries({
    queries: candidateFields.map((field) => ({
      enabled: apiClient !== null,
      queryFn: () =>
        apiClient === null
          ? Promise.reject(new Error("阶段字段候选暂时不可用。"))
          : apiClient.getStageWorkflowFieldCandidates(workflowRecordId, field.fieldCode, {
              page: 1,
              size: candidatePageSize,
            }),
      queryKey: stageWorkflowRuntimeKeys.fieldCandidatePage(
        identityKey,
        workflowRecordId,
        version,
        field.fieldCode,
        1,
        candidatePageSize,
      ),
    })),
  });
  const advanceMutation = useMutation({
    mutationFn: () =>
      apiClient === null
        ? Promise.reject(new Error("推进阶段工作流暂时不可用。"))
        : apiClient.advanceStageWorkflow(workflowRecordId, {
            ...(tasks.length > 0
              ? { completedTaskCodes: [...new Set(completedTaskCodes)].sort() }
              : {}),
            ...(fields.length > 0 ? { fieldValues: fieldValueMap(fields, fieldValues) } : {}),
            ...(addressFields.length > 0
              ? { addressFieldValues: addressFieldValueMap(addressFields, addressValues) }
              : {}),
            ...candidateFieldMaps(candidateFields, candidateFieldValues),
            ...(fileUpload !== null
              ? {
                  fileFieldDraftId: fileUpload.draft.draftId,
                  fileFields: {
                    [fileUpload.draft.fieldCode]: fileUpload.files.map((file) => file.fileId),
                  },
                }
              : {}),
            ...(selections.length > 0
              ? { selectedApprovers: selectedApproverMap(selections, selectedApprovers) }
              : {}),
            version,
          }),
    onSuccess: (record) => {
      queryClient.setQueryData(
        stageWorkflowRuntimeKeys.detail(identityKey, workflowRecordId),
        record,
      );
    },
  });
  const fileUploadMutation = useMutation({
    mutationFn: (nextFiles: File[]) =>
      apiClient === null || fileFields.length !== 1
        ? Promise.reject(new Error("阶段文件上传暂时不可用。"))
        : apiClient.uploadStageWorkflowFiles(workflowRecordId, fileFields[0].fieldCode, nextFiles),
    onSuccess: (nextUpload) => {
      setFileUpload(nextUpload);
    },
  });
  const fileStatusMutation = useMutation({
    mutationFn: () =>
      apiClient === null || fileUpload === null
        ? Promise.reject(new Error("阶段文件上传状态暂时不可用。"))
        : Promise.all(
            fileUpload.files.map((file) =>
              apiClient.getStageWorkflowFileUploadStatus(
                fileUpload.draft.draftId,
                fileUpload.draft.fieldCode,
                file.fileId,
              ),
            ),
          ),
    onSuccess: (files) => {
      setFileUpload((current) => (current === null ? current : { ...current, files }));
    },
  });
  const fileUploadError = fileUploadMutation.error ?? fileStatusMutation.error;
  const candidateQueriesReady = candidateQueries.every(
    (query) => !query.isLoading && !query.isError && query.data !== undefined,
  );
  const selectionsComplete = selections.every(
    (selection) => (selectedApprovers[selection.code]?.length ?? 0) > 0,
  );
  const requiredTasksComplete = tasks
    .filter((task) => task.required)
    .every((task) => completedTaskCodes.includes(task.code));
  const requiredFieldsComplete = fields.every(
    (field) =>
      !field.required || normalizedFieldValues(fieldValues[field.fieldCode] ?? []).length > 0,
  );
  const addressFieldsComplete = addressFields.every((field) => {
    const draft = addressValues[field.fieldCode] ?? initialAddressDraft(field);
    const value = toAddressValue(field, draft);
    return field.required
      ? value !== null
      : field.currentAddress === null
        ? isAddressDraftEmpty(field, draft) || value !== null
        : value !== null;
  });
  const candidateFieldsReady = fieldCandidateQueries.every(
    (query) => !query.isLoading && !query.isError && query.data !== undefined,
  );
  const requiredCandidateFieldsComplete = candidateFields.every(
    (field) => !field.required || (candidateFieldValues[field.fieldCode]?.length ?? 0) > 0,
  );
  const uploadedFileIds =
    fileUpload === null
      ? []
      : fileUpload.files.filter((file) => file.status === "UPLOADED").map((file) => file.fileId);
  const fileFieldsComplete = fileFields.every(
    (field) =>
      !field.required ||
      (fileUpload?.draft.fieldCode === field.fieldCode && uploadedFileIds.length > 0),
  );
  const fileUploadConfirmed =
    fileUpload === null ||
    (fileUpload.files.length > 0 && fileUpload.files.every((file) => file.status === "UPLOADED"));
  const canAdvance =
    !advanceMutation.isPending &&
    !fileUploadMutation.isPending &&
    !fileStatusMutation.isPending &&
    requiredTasksComplete &&
    requiredFieldsComplete &&
    addressFieldsComplete &&
    requiredCandidateFieldsComplete &&
    fileFieldsComplete &&
    fileUploadConfirmed &&
    candidateFieldsReady &&
    (selections.length === 0 || (candidateQueriesReady && selectionsComplete));

  function setApprovers(selectionCode: string, actorIds: readonly (number | string)[]) {
    const nextActorIds = [
      ...new Set(actorIds.filter((id): id is number => typeof id === "number")),
    ].sort((left, right) => left - right);
    setSelectedApprovers((current) => ({ ...current, [selectionCode]: nextActorIds }));
    advanceMutation.reset();
  }

  function setCompletedTasks(taskCodes: readonly (number | string)[]) {
    setCompletedTaskCodes(
      [...new Set(taskCodes.filter((code): code is string => typeof code === "string"))].sort(),
    );
    advanceMutation.reset();
  }

  function setField(fieldCode: string, values: readonly string[]) {
    setFieldValues((current) => ({ ...current, [fieldCode]: [...values] }));
    advanceMutation.reset();
  }

  function setAddressField(fieldCode: string, part: StageWorkflowAddressPartCode, value: string) {
    const field = addressFields.find((candidate) => candidate.fieldCode === fieldCode);
    if (field === undefined) return;
    setAddressValues((current) => ({
      ...current,
      [fieldCode]: { ...(current[fieldCode] ?? initialAddressDraft(field)), [part]: value },
    }));
    advanceMutation.reset();
  }

  function setCandidateField(fieldCode: string, values: readonly (number | string)[]) {
    setCandidateFieldValues((current) => ({
      ...current,
      [fieldCode]: [
        ...new Set(values.filter((value): value is number => typeof value === "number")),
      ],
    }));
    advanceMutation.reset();
  }

  return (
    <Card title="推进当前阶段">
      <Typography.Paragraph type="secondary">
        {fields.length === 0 &&
        candidateFields.length === 0 &&
        addressFields.length === 0 &&
        fileFields.length === 0 &&
        tasks.length === 0 &&
        selections.length === 0
          ? "当前阶段没有服务端要求填写的字段、完成任务或审批人选择。"
          : "当前阶段只要求填写服务端可写字段、标记服务端允许完成的任务和/或选择服务端确认的审批人；候选字段和文件草稿均按当前运行记录单独读取。"}
        推进资格和 version 均来自当前运行记录，服务端会在提交时再次校验。
      </Typography.Paragraph>
      {fields.length > 0 ? (
        <List<StageWorkflowAdvanceField>
          dataSource={[...fields]}
          renderItem={(field) => {
            const values = fieldValues[field.fieldCode] ?? [];
            const label = field.required ? `${field.displayName}（必填）` : field.displayName;
            const selectOptions = field.allowedValues.map((option) => ({
              label: option.label,
              value: option.value,
            }));
            let control: ReactNode;
            if (field.fieldType === "TEXTAREA") {
              control = (
                <Input.TextArea
                  aria-label={label}
                  value={values[0] ?? ""}
                  onChange={(event) => setField(field.fieldCode, [event.target.value])}
                />
              );
            } else if (field.fieldType === "SELECT") {
              control = (
                <Select
                  allowClear={!field.required}
                  aria-label={label}
                  options={selectOptions}
                  value={values[0]}
                  onChange={(value) =>
                    setField(field.fieldCode, value === undefined ? [] : [value])
                  }
                />
              );
            } else if (field.fieldType === "MULTI_SELECT") {
              control = (
                <Select
                  allowClear={!field.required}
                  aria-label={label}
                  mode="multiple"
                  options={selectOptions}
                  value={[...values]}
                  onChange={(nextValues) => setField(field.fieldCode, nextValues)}
                />
              );
            } else if (field.fieldType === "BOOLEAN") {
              control = (
                <Select
                  allowClear={!field.required}
                  aria-label={label}
                  options={[
                    { label: "是", value: "true" },
                    { label: "否", value: "false" },
                  ]}
                  value={values[0]}
                  onChange={(value) =>
                    setField(field.fieldCode, value === undefined ? [] : [value])
                  }
                />
              );
            } else {
              control = (
                <Input
                  aria-label={label}
                  step={field.fieldType === "DECIMAL" ? "any" : undefined}
                  type={inputType(field)}
                  value={values[0] ?? ""}
                  onChange={(event) => setField(field.fieldCode, [event.target.value])}
                />
              );
            }
            return (
              <List.Item>
                <div style={{ display: "grid", gap: 8, width: "100%" }}>
                  <Typography.Text strong>{label}</Typography.Text>
                  {control}
                </div>
              </List.Item>
            );
          }}
        />
      ) : null}
      {addressFields.length > 0 ? (
        <List<StageWorkflowAddressField>
          dataSource={[...addressFields]}
          renderItem={(field) => {
            const draft = addressValues[field.fieldCode] ?? initialAddressDraft(field);
            return (
              <List.Item>
                <div style={{ display: "grid", gap: 8, width: "100%" }}>
                  <Typography.Text strong>
                    {field.required ? `${field.displayName}（必填）` : field.displayName}
                  </Typography.Text>
                  {field.parts.map((part) => {
                    const label = part.required ? `${part.displayName}（必填）` : part.displayName;
                    const numeric = part.code === "longitude" || part.code === "latitude";
                    return (
                      <Input
                        aria-label={`${field.displayName}：${label}`}
                        key={part.code}
                        maxLength={part.maxLength}
                        placeholder={label}
                        type={numeric ? "number" : "text"}
                        value={draft[part.code]}
                        onChange={(event) =>
                          setAddressField(field.fieldCode, part.code, event.target.value)
                        }
                      />
                    );
                  })}
                </div>
              </List.Item>
            );
          }}
        />
      ) : null}
      {candidateFields.length > 0 ? (
        <List<StageWorkflowCandidateField>
          dataSource={[...candidateFields]}
          renderItem={(field, index) => {
            const query = fieldCandidateQueries[index];
            const valueType =
              field.fieldType === "USER"
                ? "ACTOR_ID"
                : field.fieldType === "DEPARTMENT"
                  ? "DEPARTMENT_ID"
                  : "RELATION_ID";
            return (
              <List.Item>
                <div style={{ width: "100%" }}>
                  <Typography.Text strong>
                    {field.required ? `${field.displayName}（必填）` : field.displayName}
                  </Typography.Text>
                  {query?.isError ? (
                    <Alert title="阶段字段候选暂时无法加载" showIcon type="error" />
                  ) : null}
                  {query?.data !== undefined ? (
                    <Checkbox.Group
                      options={query.data.candidates
                        .filter((candidate) => candidate.valueType === valueType)
                        .map((candidate) => ({
                          label: candidate.displayName,
                          value: candidate.id,
                        }))}
                      style={{ display: "grid", gap: 8, marginTop: 8 }}
                      value={[...(candidateFieldValues[field.fieldCode] ?? [])]}
                      onChange={(values) => setCandidateField(field.fieldCode, values)}
                    />
                  ) : null}
                </div>
              </List.Item>
            );
          }}
        />
      ) : null}
      {fileFields.length === 1 ? (
        <Card
          size="small"
          title={
            fileFields[0].required
              ? `${fileFields[0].displayName}（必填）`
              : fileFields[0].displayName
          }
        >
          <Typography.Paragraph type="secondary">
            文件先由当前运行记录的服务端草稿与上传意图确认；只有状态为“已上传”的文件 ID
            才会随本次推进提交。
          </Typography.Paragraph>
          <input
            aria-label={`选择${fileFields[0].displayName}`}
            disabled={fileUploadMutation.isPending || fileStatusMutation.isPending}
            multiple
            type="file"
            onChange={(event) => {
              const nextFiles = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (nextFiles.length === 0) return;
              fileStatusMutation.reset();
              fileUploadMutation.mutate(nextFiles);
            }}
          />
          {fileUpload?.draft.fieldCode === fileFields[0].fieldCode ? (
            <List
              dataSource={fileUpload.files}
              renderItem={(file) => (
                <List.Item>
                  <Space>
                    <Typography.Text>{file.displayName}</Typography.Text>
                    <Typography.Text type="secondary">{file.size} bytes</Typography.Text>
                    <Typography.Text type={file.status === "UPLOADED" ? "success" : "secondary"}>
                      {file.status === "UPLOADED"
                        ? "已上传"
                        : file.status === "PENDING"
                          ? "等待确认"
                          : "上传失败"}
                    </Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          ) : null}
          {fileUpload?.files.some((file) => file.status === "PENDING") ? (
            <Button
              loading={fileStatusMutation.isPending}
              size="small"
              style={{ marginTop: 8 }}
              onClick={() => fileStatusMutation.mutate()}
            >
              确认上传状态
            </Button>
          ) : null}
          {fileUpload !== null ? (
            <Button
              disabled={fileUploadMutation.isPending || fileStatusMutation.isPending}
              size="small"
              style={{ marginLeft: 8, marginTop: 8 }}
              onClick={() => {
                setFileUpload(null);
                fileUploadMutation.reset();
                fileStatusMutation.reset();
                advanceMutation.reset();
              }}
            >
              清除本次文件
            </Button>
          ) : null}
          {fileUploadMutation.isError || fileStatusMutation.isError ? (
            <Alert
              title={
                fileUploadError instanceof ApiError
                  ? fileUploadError.message
                  : "阶段文件暂时无法确认，请重新选择文件或稍后确认上传状态。"
              }
              showIcon
              style={{ marginTop: 8 }}
              type="error"
            />
          ) : null}
        </Card>
      ) : null}
      {tasks.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong>完成当前任务</Typography.Text>
          <Checkbox.Group
            options={tasks.map((task) => ({
              label: task.required ? `${task.name}（必填）` : `${task.name}（可选）`,
              value: task.code,
            }))}
            style={{ display: "grid", gap: 8, marginTop: 8 }}
            value={[...completedTaskCodes]}
            onChange={setCompletedTasks}
          />
        </div>
      ) : null}
      {selections.length > 0 ? (
        <List<StageWorkflowAdvanceSelection>
          dataSource={[...selections]}
          renderItem={(selection, index) => {
            const candidateQuery = candidateQueries[index];
            const candidates = candidateQuery?.data;
            const page = candidatePages[selection.code] ?? 1;
            return (
              <List.Item>
                <div style={{ width: "100%" }}>
                  <Typography.Text strong>{selection.name}</Typography.Text>
                  {candidateQuery?.isLoading ? (
                    <Typography.Text>正在加载候选人…</Typography.Text>
                  ) : null}
                  {candidateQuery?.isError ? (
                    <Alert
                      title={
                        candidateQuery.error instanceof ApiError
                          ? candidateQuery.error.message
                          : "阶段审批人候选暂时无法加载"
                      }
                      showIcon
                      style={{ marginTop: 8 }}
                      type="error"
                    />
                  ) : null}
                  {candidates !== undefined ? (
                    <>
                      <Checkbox.Group
                        options={candidates.candidates.map((candidate) => ({
                          label: candidate.displayName,
                          value: candidate.actorId,
                        }))}
                        style={{ display: "grid", gap: 8, marginTop: 8 }}
                        value={[...(selectedApprovers[selection.code] ?? [])]}
                        onChange={(actorIds) => setApprovers(selection.code, actorIds)}
                      />
                      {candidates.total > candidatePageSize ? (
                        <Pagination
                          current={page}
                          pageSize={candidatePageSize}
                          showSizeChanger={false}
                          size="small"
                          style={{ marginTop: 8 }}
                          total={candidates.total}
                          onChange={(nextPage) =>
                            setCandidatePages((current) => ({
                              ...current,
                              [selection.code]: nextPage,
                            }))
                          }
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>
              </List.Item>
            );
          }}
        />
      ) : null}
      {advanceMutation.isError ? (
        <Alert
          action={
            <Button
              onClick={() => {
                advanceMutation.reset();
                onRefresh();
              }}
              size="small"
              type="primary"
            >
              刷新运行记录
            </Button>
          }
          title={
            advanceMutation.error instanceof ApiError
              ? advanceMutation.error.message
              : "推进阶段工作流暂时无法完成"
          }
          showIcon
          type="error"
        />
      ) : null}
      <Popconfirm
        cancelText="取消"
        description="服务端会以当前阶段、资源级 ADVANCE capability 和 version 再次校验。"
        okText="确认推进"
        title="确认推进当前阶段吗？"
        onConfirm={() => advanceMutation.mutate()}
      >
        <Button disabled={!canAdvance} loading={advanceMutation.isPending} type="primary">
          推进阶段
        </Button>
      </Popconfirm>
    </Card>
  );
}
