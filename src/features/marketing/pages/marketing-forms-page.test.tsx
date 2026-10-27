import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { MarketingFormsPage } from "./marketing-forms-page";

afterEach(cleanup);

function renderPage(apiClient: ApiClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MemoryRouter initialEntries={["/marketing/forms?page=1&size=15"]}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            adapter: null,
            state: { identityKey: "marketing-form-test", mode: "production", ready: true },
            status: "ready",
          }}
        >
          <BootstrapContext.Provider
            value={{
              apiClient,
              authorization: {
                actorId: 7,
                authorities: ["marketing-forms:read", "marketing-forms:write"],
                dataScopes: {},
                roles: [],
              },
              error: null,
              navigation: [],
              reload: async () => undefined,
              status: "ready",
            }}
          >
            <MarketingFormsPage />
          </BootstrapContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("MarketingFormsPage", () => {
  it("reloads the selected form detail instead of using the list row as an action baseline", async () => {
    const apiClient = {
      getMarketingForm: vi.fn().mockResolvedValue({
        fields: [{ fieldCode: "lead_name", label: "服务端详情字段", required: true }],
        id: 8,
        name: "服务端详情名称",
        publicId: "authoritative-public-id",
        status: "INACTIVE",
        targetObjectType: "LEAD",
        title: "服务端详情标题",
        version: 4,
      }),
      getMarketingFormSubmissionLinks: vi.fn().mockResolvedValue({
        objectList: [],
        pageNum: 1,
        pageSize: 20,
        totalNum: 0,
      }),
      getMarketingForms: vi.fn().mockResolvedValue({
        objectList: [
          {
            fields: [],
            id: 8,
            name: "列表旧名称",
            publicId: "stale-public-id",
            status: "INACTIVE",
            targetObjectType: "LEAD",
            title: "列表旧标题",
            version: 3,
          },
        ],
        pageNum: 1,
        pageSize: 15,
        totalNum: 1,
      }),
      getMarketingFormSubmissionTrend: vi.fn().mockResolvedValue({ points: [] }),
    } as unknown as ApiClient;

    renderPage(apiClient);

    const viewButton = await waitFor(() => {
      const buttons = screen.queryAllByRole("button", { name: /查\s*看/u });
      expect(buttons.length).toBeGreaterThan(0);
      return buttons[0]!;
    });
    fireEvent.click(viewButton);

    await waitFor(() => expect(apiClient.getMarketingForm).toHaveBeenCalledWith(8));
    const detail = await screen.findByRole("dialog");
    expect(within(detail).getByText("服务端详情名称")).toBeInTheDocument();
    expect(within(detail).queryByText("列表旧标题")).not.toBeInTheDocument();
    expect(within(detail).getByText("服务端详情字段")).toBeInTheDocument();
  }, 30_000);
});
