import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { WorklistPage } from "./worklist-page";

afterEach(cleanup);

function renderPage(apiClient: ApiClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MemoryRouter initialEntries={["/worklist?date=2026-08-10"]}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            adapter: null,
            state: { identityKey: "worklist-test", mode: "production", ready: true },
            status: "ready",
          }}
        >
          <BootstrapContext.Provider
            value={{
              apiClient,
              authorization: {
                actorId: 7,
                authorities: ["worklist:read"],
                dataScopes: {},
                roles: [],
              },
              error: null,
              navigation: [],
              reload: async () => undefined,
              status: "ready",
            }}
          >
            <WorklistPage />
          </BootstrapContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("WorklistPage", () => {
  it("uses the recovered date and confirms only the server-issued item fingerprint", async () => {
    const apiClient = {
      acknowledgeWorklist: vi.fn().mockResolvedValue(undefined),
      getWorklist: vi.fn().mockResolvedValue({
        items: [
          {
            dueTime: "2026-08-10T09:00:00",
            kind: "FOLLOW_UP",
            sourceId: 8,
            sourceVersion: 3,
            subjectId: 12,
            subjectType: "CUSTOMER",
            summary: "确认本周回访",
          },
        ],
        nextCursor: null,
      }),
    } as unknown as ApiClient;

    renderPage(apiClient);

    await waitFor(() =>
      expect(apiClient.getWorklist).toHaveBeenCalledWith({
        cursor: undefined,
        date: "2026-08-10",
        size: 50,
      }),
    );
    await screen.findByText("确认本周回访");

    fireEvent.click(screen.getByRole("button", { name: /^确\s*认$/u }));

    await waitFor(() =>
      expect(apiClient.acknowledgeWorklist).toHaveBeenCalledWith({
        date: "2026-08-10",
        items: [
          {
            dueTime: "2026-08-10T09:00:00",
            kind: "FOLLOW_UP",
            sourceId: 8,
            sourceVersion: 3,
          },
        ],
      }),
    );
  });

  it("requires an explicit confirmation before acknowledging a whole category", async () => {
    const apiClient = {
      acknowledgeWorklist: vi.fn().mockResolvedValue(undefined),
      getWorklist: vi.fn().mockResolvedValue({
        items: [
          {
            dueTime: "2026-08-10T09:00:00",
            kind: "FOLLOW_UP",
            sourceId: 8,
            sourceVersion: 3,
            subjectId: 12,
            subjectType: "CUSTOMER",
            summary: "确认本周回访",
          },
        ],
        nextCursor: null,
      }),
    } as unknown as ApiClient;

    renderPage(apiClient);

    await screen.findByText("确认本周回访");
    fireEvent.click(screen.getByRole("button", { name: /^确认全部跟进提醒$/u }));
    expect(apiClient.acknowledgeWorklist).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^确\s*认\s*全\s*部$/u }));

    await waitFor(() =>
      expect(apiClient.acknowledgeWorklist).toHaveBeenCalledWith({
        date: "2026-08-10",
        kind: "FOLLOW_UP",
      }),
    );
  });
});
