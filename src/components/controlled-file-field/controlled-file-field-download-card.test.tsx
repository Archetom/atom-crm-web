import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { ControlledFileFieldDownloadCard } from "./controlled-file-field-download-card";

const mocks = vi.hoisted(() => ({ saveControlledDownload: vi.fn() }));

vi.mock("~/api/client/controlled-download", () => ({
  saveControlledDownload: mocks.saveControlledDownload,
}));

afterEach(() => {
  cleanup();
  mocks.saveControlledDownload.mockReset();
});

function renderCard(apiClient: ApiClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          adapter: null,
          state: { identityKey: "file-field-card-test", mode: "production", ready: true },
          status: "ready",
        }}
      >
        <BootstrapContext.Provider
          value={{
            apiClient,
            authorization: null,
            error: null,
            navigation: [],
            reload: async () => undefined,
            status: "ready",
          }}
        >
          <ControlledFileFieldDownloadCard
            canRead
            fileFields={[
              {
                attachments: [
                  {
                    actualBytes: 24,
                    displayName: "客户协议.pdf",
                    fileId: 8,
                    mediaType: "application/pdf",
                  },
                ],
                fieldCode: "agreement",
              },
            ]}
            targetId={7}
            targetType="customer"
            title="客户字段附件"
          />
        </BootstrapContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("ControlledFileFieldDownloadCard", () => {
  it("downloads only the current detail's server-projected target, field code and file ID", async () => {
    const download = {
      blob: new Blob(["content"]),
      contentType: "application/pdf",
      fileName: "客户协议.pdf",
    };
    const apiClient = {
      downloadFileField: vi.fn().mockResolvedValue(download),
    } as unknown as ApiClient;
    renderCard(apiClient);

    fireEvent.click(screen.getByRole("button", { name: "下载" }));

    await waitFor(() =>
      expect(apiClient.downloadFileField).toHaveBeenCalledWith({
        fieldCode: "agreement",
        fileId: 8,
        targetId: 7,
        targetType: "customer",
      }),
    );
    expect(mocks.saveControlledDownload).toHaveBeenCalledWith(download);
  });
});
