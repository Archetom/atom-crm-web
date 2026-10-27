import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { organizationKeys } from "../model/query-keys";

import { OrganizationMembershipRequestsPage } from "./organization-membership-requests-page";

const identityKey = "membership-review-test";

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  return {
    ...actual,
    Popconfirm: ({
      children,
      onConfirm,
      title,
    }: {
      children: ReactNode;
      onConfirm: () => void;
      title: ReactNode;
    }) => (
      <>
        {children}
        <button onClick={onConfirm} type="button">
          {title}
        </button>
      </>
    ),
  };
});

afterEach(cleanup);

function requestPage(status: "APPROVED" | "PENDING") {
  return {
    objectList: [
      {
        applicantActorId: 7,
        createdTime: "2026-08-12T10:00:00Z",
        id: 12,
        status,
        targetTenantId: 10,
        updatedTime: "2026-08-12T10:00:00Z",
      },
    ],
    pageNum: 1,
    pageSize: 20,
    totalNum: 1,
  };
}

function renderPage(apiClient: ApiClient, queryClient: QueryClient) {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            adapter: null,
            state: {
              actorId: 7,
              identityKey,
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
                authorities: ["organization:write"],
                dataScopes: {},
                roles: [],
              },
              error: null,
              navigation: [],
              reload: async () => undefined,
              status: "ready",
            }}
          >
            <OrganizationMembershipRequestsPage />
          </BootstrapContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("OrganizationMembershipRequestsPage", () => {
  it("refreshes the review page and invalidates every cached member page after approval", async () => {
    const apiClient = {
      approveMembershipRequest: vi.fn().mockResolvedValue(undefined),
      getMembershipRequests: vi
        .fn()
        .mockResolvedValueOnce(requestPage("PENDING"))
        .mockResolvedValueOnce(requestPage("APPROVED")),
    } as unknown as ApiClient;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const memberKey = organizationKeys.members(identityKey, { page: 2, size: 20 });
    queryClient.setQueryData(memberKey, {
      objectList: [],
      pageNum: 2,
      pageSize: 20,
      totalNum: 0,
    });

    renderPage(apiClient, queryClient);

    expect(await screen.findByRole("button", { name: "通过" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "通过此成员申请？" }));

    await waitFor(() => expect(apiClient.approveMembershipRequest).toHaveBeenCalledWith(12));
    await waitFor(() => expect(apiClient.getMembershipRequests).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(queryClient.getQueryState(memberKey)?.isInvalidated).toBe(true));
    expect(await screen.findAllByText("APPROVED")).toHaveLength(2);
  });
});
