import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { DashboardPage } from "./dashboard-page";

afterEach(cleanup);

function renderPage(apiClient: ApiClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MemoryRouter initialEntries={["/"]}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            adapter: null,
            state: { identityKey: "dashboard-test", mode: "production", ready: true },
            status: "ready",
          }}
        >
          <BootstrapContext.Provider
            value={{
              apiClient,
              authorization: {
                actorId: 7,
                authorities: ["reports:read"],
                dataScopes: {},
                roles: [],
              },
              error: null,
              navigation: [],
              reload: async () => undefined,
              status: "ready",
            }}
          >
            <DashboardPage />
          </BootstrapContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  it("closes the reminder through the complete versioned server preference", async () => {
    const apiClient = {
      getDashboardOverview: vi.fn().mockResolvedValue({
        asOfDate: "2026-08-11",
        cards: [],
        customerContactReminder: {
          buckets: [
            { bucket: "OVER_7_DAYS", count: 0 },
            { bucket: "OVER_15_DAYS", count: 0 },
            { bucket: "OVER_30_DAYS", count: 0 },
            { bucket: "OVER_3_MONTHS", count: 0 },
            { bucket: "OVER_6_MONTHS", count: 0 },
            { bucket: "OVERDUE", count: 0 },
          ],
          status: "AVAILABLE",
        },
        from: "2026-08-01",
        granularity: "DAY",
        preferredDataScope: "SELF",
        rankings: [],
        salesBrief: [],
        dataSummary: [],
        salesFunnel: { pipelines: [], status: "UNAVAILABLE" },
        target: { status: "EMPTY" },
        timeRange: "CURRENT_MONTH",
        to: "2026-08-31",
      }),
      getDashboardPreference: vi.fn().mockResolvedValue({
        dataScope: "SELF",
        hiddenModules: [],
        timeRange: "CURRENT_MONTH",
        version: 9,
      }),
      updateDashboardPreference: vi.fn().mockResolvedValue({
        dataScope: "SELF",
        hiddenModules: ["CUSTOMER_CONTACT_REMINDER"],
        timeRange: "CURRENT_MONTH",
        version: 10,
      }),
    } as unknown as ApiClient;
    renderPage(apiClient);

    fireEvent.click(await screen.findByRole("button", { name: "关闭" }));

    await waitFor(() =>
      expect(apiClient.updateDashboardPreference).toHaveBeenCalledWith({
        customEndDate: undefined,
        customStartDate: undefined,
        dataScope: "SELF",
        hiddenModules: ["CUSTOMER_CONTACT_REMINDER"],
        timeRange: "CURRENT_MONTH",
        version: 9,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "已关闭客户遗忘提醒，可在工具栏中恢复显示。",
    );
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "客户遗忘提醒" })).not.toBeInTheDocument(),
    );
  });
});
