import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { WorkTaskAttachmentsModal } from "./work-task-attachments-modal";

afterEach(cleanup);

function renderAttachmentsModal(apiClient: ApiClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          adapter: null,
          state: { identityKey: "work-task-attachment-test", mode: "production", ready: true },
          status: "ready",
        }}
      >
        <BootstrapContext.Provider
          value={{
            apiClient,
            authorization: {
              actorId: 7,
              authorities: ["work-tasks:read", "work-tasks:write", "files:read", "files:write"],
              dataScopes: {},
              roles: [],
            },
            error: null,
            navigation: [],
            reload: async () => undefined,
            status: "ready",
          }}
        >
          <WorkTaskAttachmentsModal open taskId={42} onClose={vi.fn()} />
        </BootstrapContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("WorkTaskAttachmentsModal", () => {
  it("uploads selected bytes to the fixed work-task target and reports publication", async () => {
    const apiClient = {
      getWorkTaskAttachments: vi
        .fn()
        .mockResolvedValue({ objectList: [], pageNum: 1, pageSize: 20, totalNum: 0 }),
      uploadAttachments: vi.fn().mockResolvedValue([
        {
          fileId: 17,
          status: { status: "AVAILABLE" },
        },
      ]),
    } as unknown as ApiClient;
    renderAttachmentsModal(apiClient);

    await screen.findByRole("button", { name: "上传任务附件" });
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    const file = new File(["brief"], "任务说明.pdf", { type: "application/pdf" });

    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() =>
      expect(apiClient.uploadAttachments).toHaveBeenCalledWith(
        { targetId: 42, targetType: "work-task" },
        [file],
      ),
    );
    expect(await screen.findByText("附件已上传并可下载。")).not.toBeNull();
  });
});
