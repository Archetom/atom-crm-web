import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import type { components } from "~/api/generated/schema";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { OrganizationMembersPage } from "./organization-members-page";

type MemberPage = components["schemas"]["MemberProfilePageResponse"];

afterEach(cleanup);

function memberPage(): MemberPage {
  return {
    objectList: [
      {
        active: true,
        actorId: 7,
        displayName: "Alice",
        email: "alice@example.com",
        maskedPhoneNumber: "+86138****8000",
      },
    ],
    pageNum: 1,
    pageSize: 15,
    totalNum: 1,
  };
}

function RecoveredKeywordControl() {
  const [, setSearchParams] = useSearchParams();

  return (
    <button
      onClick={() => setSearchParams({ keyword: "recovered-member", page: "2", size: "15" })}
      type="button"
    >
      恢复成员筛选
    </button>
  );
}

function renderPage(apiClient: ApiClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MemoryRouter initialEntries={["/organization/members?keyword=alice"]}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            adapter: null,
            state: { identityKey: "organization-members-test", mode: "production", ready: true },
            status: "ready",
          }}
        >
          <BootstrapContext.Provider
            value={{
              apiClient,
              authorization: {
                actorId: 7,
                authorities: ["organization:read"],
                dataScopes: {},
                roles: [],
              },
              error: null,
              navigation: [],
              reload: async () => undefined,
              status: "ready",
            }}
          >
            <RecoveredKeywordControl />
            <OrganizationMembersPage />
          </BootstrapContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("OrganizationMembersPage", () => {
  it("synchronizes the keyword input with URL-recovered member filters", async () => {
    const apiClient = {
      getOrganizationMembers: vi.fn().mockResolvedValue(memberPage()),
    } as unknown as ApiClient;

    renderPage(apiClient);

    await waitFor(() =>
      expect(apiClient.getOrganizationMembers).toHaveBeenCalledWith({
        keyword: "alice",
        page: 1,
        size: 15,
      }),
    );
    const search = screen.getByPlaceholderText("搜索成员姓名");
    expect(search).toHaveValue("alice");

    fireEvent.change(search, { target: { value: "未提交草稿" } });
    expect(search).toHaveValue("未提交草稿");
    fireEvent.click(screen.getByRole("button", { name: "恢复成员筛选" }));

    await waitFor(() =>
      expect(apiClient.getOrganizationMembers).toHaveBeenLastCalledWith({
        keyword: "recovered-member",
        page: 2,
        size: 15,
      }),
    );
    expect(screen.getByPlaceholderText("搜索成员姓名")).toHaveValue("recovered-member");
  });
});
