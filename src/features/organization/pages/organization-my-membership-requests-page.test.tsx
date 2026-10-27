import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { OrganizationMyMembershipRequestsPage } from "./organization-my-membership-requests-page";

afterEach(cleanup);

function renderPage(apiClient: ApiClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            adapter: null,
            state: {
              actorId: 7,
              identityKey: "membership-request-test",
              mode: "production",
              ready: true,
              tenantId: 10,
            },
            status: "ready",
          }}
        >
          <BootstrapContext.Provider
            value={{
              apiClient,
              authorization: {
                actorId: 7,
                authorities: ["organization:request"],
                dataScopes: {},
                roles: [],
              },
              error: null,
              navigation: [],
              reload: async () => undefined,
              status: "ready",
            }}
          >
            <OrganizationMyMembershipRequestsPage />
          </BootstrapContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("OrganizationMyMembershipRequestsPage", () => {
  it("loads only the caller-owned request page and explains the safe target-tenant boundary", async () => {
    const apiClient = {
      getMyMembershipRequests: vi.fn().mockResolvedValue({
        objectList: [
          {
            applicantActorId: 7,
            createdTime: "2026-08-11T10:00:00Z",
            id: 12,
            message: "申请加入",
            status: "PENDING",
            targetTenantId: 99,
            updatedTime: "2026-08-11T10:00:00Z",
          },
        ],
        pageNum: 1,
        pageSize: 20,
        totalNum: 1,
      }),
    } as unknown as ApiClient;

    renderPage(apiClient);

    await waitFor(() =>
      expect(apiClient.getMyMembershipRequests).toHaveBeenCalledWith({ page: 1, size: 15 }),
    );
    expect(await screen.findAllByText("租户 99")).toHaveLength(2);
    expect(screen.getAllByText("待审核")).toHaveLength(2);
    expect(screen.getByText(/不会枚举其他租户/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "申请加入租户" })).toBeInTheDocument();
  });
});
