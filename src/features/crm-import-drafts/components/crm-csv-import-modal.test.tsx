import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";

import { CrmCsvImportModal } from "./crm-csv-import-modal";

const mocks = vi.hoisted(() => ({ saveControlledDownload: vi.fn() }));

vi.mock("~/api/client/controlled-download", () => ({
  saveControlledDownload: mocks.saveControlledDownload,
}));

afterEach(() => {
  cleanup();
  mocks.saveControlledDownload.mockReset();
});

function renderModal(
  apiClient: ApiClient,
  onCompleted = vi.fn(),
  onCancel = vi.fn(),
  objectType: "LEAD" | "CONTACT" | "PRODUCT" = "LEAD",
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CrmCsvImportModal
        apiClient={apiClient}
        identityKey="crm-import-draft-test"
        objectType={objectType}
        open
        onCancel={onCancel}
        onCompleted={onCompleted}
      />
    </QueryClientProvider>,
  );
  return { onCancel, onCompleted };
}

function selectCsv(file = new File(["name\n线索 A\n"], "线索.csv", { type: "text/csv" })) {
  const input = screen.getByLabelText("选择线索 CSV 文件") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

describe("CrmCsvImportModal", () => {
  it("uses the controlled source, previews it, then confirms the atomic import", async () => {
    const apiClient = {
      confirmCrmImportDraft: vi.fn().mockResolvedValue({ importedRows: 1 }),
      createCrmImportDraft: vi.fn().mockResolvedValue({ draftId: 41, version: 0 }),
      getCrmImportDraftPreview: vi.fn().mockResolvedValue({ issues: [], validRows: 1 }),
      getCrmImportDraftSourceStatus: vi.fn().mockResolvedValue({ status: "AVAILABLE" }),
      getCrmImportTemplate: vi.fn().mockResolvedValue({ columns: ["name"] }),
      uploadCrmImportDraftSource: vi
        .fn()
        .mockResolvedValue({ fileId: 51, status: { status: "AVAILABLE" } }),
    } as unknown as ApiClient;
    const { onCompleted } = renderModal(apiClient);

    const source = selectCsv();
    fireEvent.click(await screen.findByRole("button", { name: "上传并校验" }));

    await waitFor(() =>
      expect(apiClient.uploadCrmImportDraftSource).toHaveBeenCalledWith(41, source),
    );
    expect(await screen.findByText("可导入 1 行")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认导入" }));

    await waitFor(() => expect(apiClient.confirmCrmImportDraft).toHaveBeenCalledWith(41, 0));
    expect(await screen.findByText("已原子导入 1 条线索。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /完\s*成/ }));
    expect(onCompleted).toHaveBeenCalledWith(1);
  });

  it("keeps invalid rows out of the confirmation and withdraws the private draft when cancelled", async () => {
    const apiClient = {
      createCrmImportDraft: vi.fn().mockResolvedValue({ draftId: 42, version: 0 }),
      getCrmImportDraftPreview: vi.fn().mockResolvedValue({
        issues: [{ errCode: "CSV_ROW_VALIDATION_FAILED", rowNumber: 3 }],
        validRows: 0,
      }),
      getCrmImportDraftSourceStatus: vi.fn().mockResolvedValue({ status: "AVAILABLE" }),
      getCrmImportTemplate: vi.fn().mockResolvedValue({ columns: ["name"] }),
      uploadCrmImportDraftSource: vi
        .fn()
        .mockResolvedValue({ fileId: 52, status: { status: "AVAILABLE" } }),
      withdrawCrmImportDraft: vi.fn().mockResolvedValue(undefined),
    } as unknown as ApiClient;
    const { onCancel } = renderModal(apiClient);

    selectCsv();
    fireEvent.click(await screen.findByRole("button", { name: "上传并校验" }));

    expect(await screen.findByText(/第\s*3\s*行：字段格式不符合要求/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认导入" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));

    await waitFor(() => expect(apiClient.withdrawCrmImportDraft).toHaveBeenCalledWith(42, 0));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("downloads a controlled error report only for the active invalid draft", async () => {
    const download = {
      blob: new Blob(["\uFEFFrowNumber,errCode\r\n3,CSV_ROW_VALIDATION_FAILED\r\n"]),
      contentType: "text/csv;charset=UTF-8",
      fileName: "crm-import-errors.csv",
    };
    const apiClient = {
      createCrmImportDraft: vi.fn().mockResolvedValue({ draftId: 44, version: 0 }),
      downloadCrmImportDraftErrorReport: vi.fn().mockResolvedValue(download),
      getCrmImportDraftPreview: vi.fn().mockResolvedValue({
        issues: [{ errCode: "CSV_ROW_VALIDATION_FAILED", rowNumber: 3 }],
        validRows: 0,
      }),
      getCrmImportDraftSourceStatus: vi.fn().mockResolvedValue({ status: "AVAILABLE" }),
      getCrmImportTemplate: vi.fn().mockResolvedValue({ columns: ["name"] }),
      uploadCrmImportDraftSource: vi
        .fn()
        .mockResolvedValue({ fileId: 54, status: { status: "AVAILABLE" } }),
    } as unknown as ApiClient;
    renderModal(apiClient);

    selectCsv();
    fireEvent.click(await screen.findByRole("button", { name: "上传并校验" }));
    fireEvent.click(await screen.findByRole("button", { name: "下载错误报告" }));

    await waitFor(() =>
      expect(apiClient.downloadCrmImportDraftErrorReport).toHaveBeenCalledWith(44),
    );
    expect(mocks.saveControlledDownload).toHaveBeenCalledWith(download);
    expect(await screen.findByText("错误报告已下载；报告只包含行号和错误码。")).toBeInTheDocument();
  });

  it("tells product importers that repeated codes are skipped without overwriting existing products", async () => {
    const apiClient = {
      confirmCrmImportDraft: vi.fn().mockResolvedValue({ importedRows: 1 }),
      createCrmImportDraft: vi.fn().mockResolvedValue({ draftId: 43, version: 0 }),
      getCrmImportDraftPreview: vi.fn().mockResolvedValue({ issues: [], validRows: 2 }),
      getCrmImportDraftSourceStatus: vi.fn().mockResolvedValue({ status: "AVAILABLE" }),
      getCrmImportTemplate: vi.fn().mockResolvedValue({ columns: ["name", "code", "listPrice"] }),
      uploadCrmImportDraftSource: vi
        .fn()
        .mockResolvedValue({ fileId: 53, status: { status: "AVAILABLE" } }),
    } as unknown as ApiClient;
    renderModal(apiClient, vi.fn(), vi.fn(), "PRODUCT");

    const source = new File(["name,code,listPrice\n产品 A,SKU-A,12.00\n"], "产品.csv", {
      type: "text/csv",
    });
    fireEvent.change(screen.getByLabelText("选择产品 CSV 文件"), { target: { files: [source] } });
    fireEvent.click(await screen.findByRole("button", { name: "上传并校验" }));
    await waitFor(() => expect(apiClient.createCrmImportDraft).toHaveBeenCalledWith("PRODUCT"));
    fireEvent.click(screen.getByRole("button", { name: "确认导入" }));

    expect(
      await screen.findByText("已导入 1 条产品；重复产品编码已跳过，已有记录未被覆盖。"),
    ).toBeInTheDocument();
  });
});
