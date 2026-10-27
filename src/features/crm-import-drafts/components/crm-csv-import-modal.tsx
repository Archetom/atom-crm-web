import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Modal, Space, Table, Typography, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRef, useState } from "react";

import type { ApiClient } from "~/api/client/api-client";
import { saveControlledDownload } from "~/api/client/controlled-download";
import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";

export type CrmCsvImportObjectType = "LEAD" | "CONTACT" | "PRODUCT";

interface CrmCsvImportModalProps {
  apiClient: ApiClient | null;
  identityKey: string;
  objectType: CrmCsvImportObjectType;
  open: boolean;
  onCancel: () => void;
  onCompleted: (importedRows: number) => void;
}

interface ActiveDraft {
  draftId: number;
  version: number;
}

type CrmImportHistoryItem = components["schemas"]["CrmImportHistoryItemResponse"];

const maxImportSourceBytes = 1024 * 1024;
const importSourcePollingAttempts = 30;
const importSourcePollingIntervalMs = 1000;

function objectLabel(objectType: CrmCsvImportObjectType): string {
  switch (objectType) {
    case "LEAD":
      return "线索";
    case "CONTACT":
      return "联系人";
    case "PRODUCT":
      return "产品";
  }
}

function fileIssue(file: File): string | null {
  if (!file.name.trim().toLowerCase().endsWith(".csv")) return "请选择 CSV 格式的导入文件。";
  if (file.size <= 0) return "导入文件不能为空，请重新选择。";
  if (file.size > maxImportSourceBytes) return "导入文件不能超过 1 MB，请拆分后重试。";
  return null;
}

function toActiveDraft(draft: components["schemas"]["CrmImportDraftResponse"]): ActiveDraft | null {
  const { draftId, version } = draft;
  if (
    typeof draftId !== "number" ||
    !Number.isSafeInteger(draftId) ||
    draftId <= 0 ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    return null;
  }
  return { draftId, version };
}

function issueLabel(code: string | undefined): string {
  switch (code) {
    case "SOURCE_SIZE_INVALID":
      return "文件大小不符合要求";
    case "SOURCE_ENCODING_INVALID":
      return "文件必须使用 UTF-8 编码";
    case "CSV_HEADER_INVALID":
      return "表头与导入模板不一致";
    case "CSV_ROWS_REQUIRED":
      return "至少需要一行导入数据";
    case "CSV_ROW_LIMIT_EXCEEDED":
      return "导入行数超过上限";
    case "CSV_COLUMN_COUNT_INVALID":
      return "该行列数与模板不一致";
    case "CSV_ROW_VALIDATION_FAILED":
      return "字段格式不符合要求";
    case "CSV_FORMAT_INVALID":
      return "CSV 格式无法解析";
    default:
      return "该行无法导入";
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

function historyTime(value: string): string {
  return value.replace("T", " ").slice(0, 19);
}

const importHistoryColumns: ColumnsType<CrmImportHistoryItem> = [
  {
    dataIndex: "completedAt",
    key: "completedAt",
    render: (value: string) => historyTime(value),
    title: "导入时间",
  },
  { key: "operator", render: () => "当前成员", title: "操作人" },
  {
    dataIndex: "importedRows",
    key: "importedRows",
    render: (value: number) => `已导入 ${value} 条`,
    title: "导入结果",
  },
];

function downloadTemplate(
  objectType: CrmCsvImportObjectType,
  template: components["schemas"]["CrmImportTemplateResponse"],
): void {
  const columns = template.columns;
  if (!Array.isArray(columns) || columns.length === 0 || columns.some((column) => !column.trim())) {
    throw new Error("导入模板暂时不可用，请稍后重试。");
  }
  const blob = new Blob([`\uFEFF${columns.join(",")}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.download = `${objectLabel(objectType)}导入模板.csv`;
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function waitForImportSource(
  apiClient: ApiClient,
  draftId: number,
  fileId: number,
): Promise<void> {
  for (let attempt = 0; attempt < importSourcePollingAttempts; attempt += 1) {
    const status = await apiClient.getCrmImportDraftSourceStatus(draftId, fileId);
    if (status.status === "AVAILABLE") return;
    if (status.status === "REJECTED") {
      throw new Error("导入文件未通过安全检查，请重新选择文件后重试。");
    }
    if (status.status === "WITHDRAWN" || status.status === "EXPIRED") {
      throw new Error("导入草稿已失效，请重新开始导入。");
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, importSourcePollingIntervalMs));
  }
  throw new Error("导入文件仍在安全检查中，请稍后重新开始导入。");
}

export function CrmCsvImportModal({
  apiClient,
  identityKey,
  objectType,
  open,
  onCancel,
  onCompleted,
}: CrmCsvImportModalProps) {
  const queryClient = useQueryClient();
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [activeDraft, setActiveDraft] = useState<ActiveDraft | null>(null);
  const [preview, setPreview] = useState<components["schemas"]["CrmImportPreviewResponse"] | null>(
    null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [completedRows, setCompletedRows] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const activeDraftRef = useRef<ActiveDraft | null>(null);

  const templateQuery = useQuery({
    queryKey: ["crm-import-template", identityKey, objectType],
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("导入模板暂时不可用。"))
        : apiClient.getCrmImportTemplate(objectType),
    enabled: open && apiClient !== null,
  });

  const historyQuery = useQuery({
    queryKey: ["crm-import-history", identityKey, objectType, historyPage],
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("导入记录暂时不可用。"))
        : apiClient.getCrmImportHistory(objectType, historyPage),
    enabled: open && historyOpen && apiClient !== null,
  });

  const prepareMutation = useMutation({
    mutationFn: async () => {
      if (apiClient === null) throw new Error("导入服务暂时不可用，请稍后重试。");
      if (sourceFile === null) throw new Error("请先选择 CSV 导入文件。");
      const sourceIssue = fileIssue(sourceFile);
      if (sourceIssue !== null) throw new Error(sourceIssue);

      const created = await apiClient.createCrmImportDraft(objectType);
      const draft = toActiveDraft(created);
      if (draft === null) throw new Error("导入草稿暂时不可用，请重新开始导入。");
      activeDraftRef.current = draft;
      setActiveDraft(draft);
      const uploaded = await apiClient.uploadCrmImportDraftSource(draft.draftId, sourceFile);
      await waitForImportSource(apiClient, draft.draftId, uploaded.fileId);
      return apiClient.getCrmImportDraftPreview(draft.draftId);
    },
    onMutate: () => {
      setFeedback(null);
      setPreview(null);
      setCompletedRows(null);
    },
    onSuccess: (nextPreview) => {
      setPreview(nextPreview);
      setFeedback(
        (nextPreview.issues?.length ?? 0) === 0
          ? "文件已校验通过。确认导入后，所有数据会一次性创建。"
          : "文件中存在无法导入的行。请按提示修改后重新开始导入。",
      );
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (apiClient === null || activeDraft === null) {
        throw new Error("导入草稿已失效，请重新开始导入。");
      }
      return apiClient.confirmCrmImportDraft(activeDraft.draftId, activeDraft.version);
    },
    onSuccess: (result) => {
      const importedRows = result.importedRows;
      activeDraftRef.current = null;
      setActiveDraft(null);
      if (
        typeof importedRows !== "number" ||
        !Number.isSafeInteger(importedRows) ||
        importedRows < 0
      ) {
        setCompletedRows(0);
        setFeedback("导入已提交，请刷新列表确认结果。");
        return;
      }
      setCompletedRows(importedRows);
      void queryClient.invalidateQueries({
        queryKey: ["crm-import-history", identityKey, objectType],
      });
      setFeedback(
        objectType === "PRODUCT"
          ? `已导入 ${importedRows} 条产品；重复产品编码已跳过，已有记录未被覆盖。`
          : `已原子导入 ${importedRows} 条${objectLabel(objectType)}。`,
      );
    },
  });

  const errorReportMutation = useMutation({
    mutationFn: async () => {
      if (apiClient === null || activeDraft === null) {
        throw new Error("导入草稿已失效，请重新开始导入。");
      }
      return apiClient.downloadCrmImportDraftErrorReport(activeDraft.draftId);
    },
    onSuccess: (download) => {
      saveControlledDownload(download);
      setFeedback("错误报告已下载；报告只包含行号和错误码。");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const draft = activeDraftRef.current;
      if (apiClient === null || draft === null) return;
      await apiClient.withdrawCrmImportDraft(draft.draftId, draft.version);
    },
    onSuccess: () => {
      activeDraftRef.current = null;
      setActiveDraft(null);
      setSourceFile(null);
      setPreview(null);
      setFeedback(null);
      setCompletedRows(null);
      onCancel();
    },
  });

  const issues = preview?.issues ?? [];
  const validRows = preview?.validRows ?? 0;
  const canConfirm =
    activeDraft !== null &&
    completedRows === null &&
    validRows > 0 &&
    issues.length === 0 &&
    !prepareMutation.isPending;
  const pending =
    prepareMutation.isPending ||
    confirmMutation.isPending ||
    errorReportMutation.isPending ||
    withdrawMutation.isPending;

  function resetAndClose() {
    if (pending) return;
    if (activeDraftRef.current !== null) {
      withdrawMutation.mutate();
      return;
    }
    setSourceFile(null);
    setPreview(null);
    setFeedback(null);
    setCompletedRows(null);
    onCancel();
  }

  function finish() {
    if (completedRows === null) return;
    setActiveDraft(null);
    setSourceFile(null);
    setPreview(null);
    setFeedback(null);
    setCompletedRows(null);
    onCompleted(completedRows);
  }

  return (
    <Modal
      destroyOnHidden
      footer={
        completedRows !== null ? (
          <Button type="primary" onClick={finish}>
            完成
          </Button>
        ) : (
          <Space>
            <Button disabled={pending} onClick={resetAndClose}>
              取消
            </Button>
            {preview === null ? (
              <Button
                disabled={sourceFile === null || activeDraft !== null}
                loading={prepareMutation.isPending}
                type="primary"
                onClick={() => prepareMutation.mutate()}
              >
                上传并校验
              </Button>
            ) : (
              <Button
                disabled={!canConfirm}
                loading={confirmMutation.isPending}
                type="primary"
                onClick={() => confirmMutation.mutate()}
              >
                确认导入
              </Button>
            )}
          </Space>
        )
      }
      open={open}
      title={`导入${objectLabel(objectType)} CSV`}
      onCancel={resetAndClose}
    >
      <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
        <Typography.Paragraph type="secondary">
          {objectType === "PRODUCT"
            ? "先下载服务端定义的模板，填写后上传 CSV。文件会先经过安全检查和整表校验；重复的产品编码会跳过，已有产品不会被覆盖。"
            : "先下载服务端定义的模板，填写后上传 CSV。文件会先经过安全检查和整表校验；只有全部有效时才会一次性创建记录。"}
        </Typography.Paragraph>
        <Space wrap>
          <Button
            disabled={templateQuery.isLoading || templateQuery.data === undefined}
            onClick={() => {
              if (templateQuery.data === undefined) return;
              try {
                downloadTemplate(objectType, templateQuery.data);
                setFeedback("模板已下载，请填写后选择该 CSV 文件。");
              } catch (error) {
                setFeedback(errorMessage(error, "导入模板暂时无法下载。"));
              }
            }}
          >
            下载模板
          </Button>
          <Button
            disabled={pending || apiClient === null}
            onClick={() => {
              setHistoryPage(1);
              setHistoryOpen(true);
            }}
          >
            查看导入记录
          </Button>
          <Upload
            accept=".csv,text/csv"
            aria-label={`选择${objectLabel(objectType)} CSV 文件`}
            beforeUpload={(file) => {
              const sourceIssue = fileIssue(file);
              if (sourceIssue !== null) {
                setFeedback(sourceIssue);
                return Upload.LIST_IGNORE;
              }
              setFeedback(null);
              setPreview(null);
              setSourceFile(file);
              return false;
            }}
            disabled={pending || preview !== null || completedRows !== null}
            maxCount={1}
            onRemove={() => {
              setSourceFile(null);
              setFeedback(null);
            }}
          >
            <Button disabled={pending || preview !== null || completedRows !== null}>
              选择 CSV 文件
            </Button>
          </Upload>
        </Space>
        {templateQuery.isError ? (
          <Alert
            title={errorMessage(templateQuery.error, "导入模板暂时无法加载。")}
            showIcon
            type="error"
          />
        ) : null}
        {prepareMutation.isPending ? (
          <Alert title="正在上传并校验文件，请勿关闭此窗口。" showIcon type="info" />
        ) : null}
        {prepareMutation.isError ? (
          <Alert
            description="为避免使用不完整的草稿，请取消后重新开始导入。"
            title={errorMessage(prepareMutation.error, "导入文件暂时无法校验。")}
            showIcon
            type="error"
          />
        ) : null}
        {confirmMutation.isError ? (
          <Alert
            title={errorMessage(confirmMutation.error, "导入暂时无法完成，请稍后重试。")}
            showIcon
            type="error"
          />
        ) : null}
        {withdrawMutation.isError ? (
          <Alert
            title={errorMessage(withdrawMutation.error, "导入草稿暂时无法取消，请稍后重试。")}
            showIcon
            type="error"
          />
        ) : null}
        {errorReportMutation.isError ? (
          <Alert
            title={errorMessage(errorReportMutation.error, "错误报告暂时无法下载，请稍后重试。")}
            showIcon
            type="error"
          />
        ) : null}
        <Typography.Text role="status">{feedback ?? ""}</Typography.Text>
        {preview !== null ? (
          <section aria-label="导入校验结果">
            <Typography.Text strong>校验结果</Typography.Text>
            <Typography.Paragraph style={{ marginBottom: issues.length > 0 ? 8 : 0, marginTop: 8 }}>
              可导入 {validRows} 行
            </Typography.Paragraph>
            {issues.length > 0 ? (
              <>
                <ul>
                  {issues.map((issue, index) => (
                    <li
                      key={`${issue.rowNumber ?? "unknown"}-${issue.errCode ?? "invalid"}-${index}`}
                    >
                      第 {issue.rowNumber ?? "—"} 行：{issueLabel(issue.errCode)}
                    </li>
                  ))}
                </ul>
                <Button
                  disabled={activeDraft === null || pending}
                  loading={errorReportMutation.isPending}
                  onClick={() => errorReportMutation.mutate()}
                >
                  下载错误报告
                </Button>
              </>
            ) : null}
          </section>
        ) : null}
      </Space>
      <Modal
        destroyOnHidden
        footer={
          <Button onClick={() => setHistoryOpen(false)} type="primary">
            关闭
          </Button>
        }
        open={historyOpen}
        title={`最近${objectLabel(objectType)}导入记录`}
        onCancel={() => setHistoryOpen(false)}
      >
        <Typography.Paragraph type="secondary">
          仅展示当前成员最近 7 天已完成的导入摘要；源文件和错误行数据不会在此保留。
        </Typography.Paragraph>
        {historyQuery.isLoading ? <Alert title="正在加载导入记录…" showIcon type="info" /> : null}
        {historyQuery.isError ? (
          <Alert
            title={errorMessage(historyQuery.error, "导入记录暂时无法加载。")}
            showIcon
            type="error"
          />
        ) : null}
        {historyQuery.data !== undefined ? (
          <Table<CrmImportHistoryItem>
            columns={importHistoryColumns}
            dataSource={historyQuery.data.items}
            locale={{ emptyText: "暂无导入记录" }}
            pagination={{
              current: historyQuery.data.page,
              onChange: (nextPage) => setHistoryPage(nextPage),
              pageSize: historyQuery.data.size,
              showSizeChanger: false,
              total: historyQuery.data.total,
            }}
            rowKey="draftId"
            size="small"
          />
        ) : null}
      </Modal>
    </Modal>
  );
}
