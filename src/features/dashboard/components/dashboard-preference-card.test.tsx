import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { DashboardPreferenceToolbar } from "./dashboard-preference-card";

afterEach(cleanup);

function renderToolbar(apiClient: ApiClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ adapter: null, state: null, status: "ready" }}>
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
          <DashboardPreferenceToolbar />
        </BootstrapContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("DashboardPreferenceToolbar", () => {
  it("keeps the versioned preference explicit and only enables applying after a selection changes", async () => {
    const apiClient = {
      getDashboardPreference: vi.fn().mockResolvedValue({
        dataScope: "DEPARTMENT_SUBTREE",
        hiddenModules: [],
        timeRange: "CURRENT_MONTH",
        version: 9,
      }),
      updateDashboardPreference: vi.fn().mockResolvedValue({
        dataScope: "SELF",
        hiddenModules: [],
        timeRange: "CURRENT_MONTH",
        version: 10,
      }),
    } as unknown as ApiClient;
    renderToolbar(apiClient);

    const applyButton = await screen.findByRole("button", { name: /应\s*用/ });
    expect(applyButton).toBeDisabled();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "数据范围" }));
    fireEvent.click(await screen.findByTitle("仅自己"));

    await waitFor(() => expect(applyButton).toBeEnabled());
    fireEvent.click(applyButton);

    await waitFor(() =>
      expect(apiClient.updateDashboardPreference).toHaveBeenCalledWith({
        dataScope: "SELF",
        hiddenModules: [],
        timeRange: "CURRENT_MONTH",
        version: 9,
      }),
    );
  });

  it("keeps a reverse custom range out of the versioned update and announces the correction", async () => {
    const apiClient = {
      getDashboardPreference: vi.fn().mockResolvedValue({
        customEndDate: "2026-08-01",
        customStartDate: "2026-08-10",
        dataScope: "SELF",
        hiddenModules: [],
        timeRange: "CUSTOM",
        version: 9,
      }),
      updateDashboardPreference: vi.fn(),
    } as unknown as ApiClient;
    renderToolbar(apiClient);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "请选择完整且有序的自定义日期范围。",
    );
    expect(screen.getByRole("button", { name: /应\s*用/ })).toBeDisabled();
    expect(apiClient.updateDashboardPreference).not.toHaveBeenCalled();
  });

  it("submits the generated module identifier only after a member explicitly hides it", async () => {
    const apiClient = {
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
    renderToolbar(apiClient);

    fireEvent.click(await screen.findByRole("checkbox", { name: "显示客户遗忘提醒" }));
    fireEvent.click(screen.getByRole("button", { name: /应\s*用/ }));

    await waitFor(() =>
      expect(apiClient.updateDashboardPreference).toHaveBeenCalledWith({
        dataScope: "SELF",
        hiddenModules: ["CUSTOMER_CONTACT_REMINDER"],
        timeRange: "CURRENT_MONTH",
        version: 9,
      }),
    );
  });
});
