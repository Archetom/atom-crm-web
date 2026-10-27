import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";
import type { NavigationItem } from "~/shared/types/api";

import { OrganizationTenantsPage } from "./organization-tenants-page";

afterEach(cleanup);

function renderPage(
  apiClient: ApiClient,
  navigation: NavigationItem[] = [],
  authorities = ["organization:request"],
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            adapter: null,
            state: {
              actorId: 7,
              identityKey: "tenant-access-test",
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
                authorities,
                dataScopes: {},
                roles: [],
              },
              error: null,
              navigation,
              reload: async () => undefined,
              status: "ready",
            }}
          >
            <OrganizationTenantsPage />
          </BootstrapContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("OrganizationTenantsPage", () => {
  it("renders only server-confirmed access and never offers a production session switch", async () => {
    const apiClient = {
      getAccessibleTenants: vi.fn().mockResolvedValue([
        { departmentId: 31, granted: true, tenantId: 10 },
        { granted: false, tenantId: 11 },
      ]),
    } as unknown as ApiClient;

    renderPage(apiClient);

    await waitFor(() => expect(apiClient.getAccessibleTenants).toHaveBeenCalledOnce());
    expect(await screen.findByText("租户 10")).toBeInTheDocument();
    expect(screen.getByText("部门 31")).toBeInTheDocument();
    expect(screen.queryByText("租户 11")).not.toBeInTheDocument();
    expect(screen.getByText("租户身份由认证服务管理")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /切换到租户/u })).not.toBeInTheDocument();
  });

  it("exposes organization management only for server-provided navigation entries", async () => {
    const apiClient = {
      getAccessibleTenants: vi.fn().mockResolvedValue([{ granted: true, tenantId: 10 }]),
    } as unknown as ApiClient;

    renderPage(
      apiClient,
      [
        {
          children: [],
          code: "organization.members",
          order: 20,
          parentCode: "organization",
          requiredAuthority: "organization:read",
          route: "/organization/members",
          titleKey: "navigation.members",
        },
        {
          children: [],
          code: "administration.users",
          order: 10,
          parentCode: "administration",
          requiredAuthority: "users:read",
          route: "/administration/users",
          titleKey: "navigation.users",
        },
      ],
      ["organization:request", "organization:read", "users:read"],
    );

    expect(await screen.findByText("租户管理")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "成员管理" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "用户管理" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "部门管理" })).not.toBeInTheDocument();
  });
});
