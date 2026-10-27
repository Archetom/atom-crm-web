import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import type { components } from "~/api/generated/schema";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { OrganizationDepartmentsPage } from "./organization-departments-page";

type Department = components["schemas"]["DepartmentResponse"];
type MemberPage = components["schemas"]["DepartmentMemberProfilePageResponse"];

afterEach(cleanup);

const departments: Department[] = [
  { active: true, id: 10, name: "销售部", status: "ACTIVE" },
  { active: true, id: 11, name: "华东组", parentDepartmentId: 10, status: "ACTIVE" },
];

function memberPage(): MemberPage {
  return {
    objectList: [
      {
        active: true,
        actorId: 7,
        displayName: "Alice",
        departmentName: "销售部",
        email: "alice@example.test",
        loginName: "alice",
        maskedPhoneNumber: "+86138****8000",
        roleNames: ["销售"],
      },
    ],
    pageNum: 2,
    pageSize: 15,
    totalNum: 16,
  };
}

function renderPage(apiClient: ApiClient, initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            adapter: null,
            state: {
              identityKey: "organization-departments-test",
              mode: "production",
              ready: true,
            },
            status: "ready",
          }}
        >
          <BootstrapContext.Provider
            value={{
              apiClient,
              authorization: {
                actorId: 7,
                authorities: ["organization:read", "roles:read", "users:read"],
                dataScopes: {},
                roles: [],
              },
              error: null,
              navigation: [],
              reload: async () => undefined,
              status: "ready",
            }}
          >
            <OrganizationDepartmentsPage />
          </BootstrapContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("OrganizationDepartmentsPage", () => {
  it("uses the URL-selected server-visible department for the member directory", async () => {
    const apiClient = {
      getOrganizationDepartmentMembers: vi.fn().mockResolvedValue(memberPage()),
      getOrganizationDepartments: vi.fn().mockResolvedValue(departments),
    } as unknown as ApiClient;

    renderPage(
      apiClient,
      "/organization/departments?departmentId=10&includeDescendants=true&memberKeyword=alice&memberPage=2",
    );

    await waitFor(() =>
      expect(apiClient.getOrganizationDepartmentMembers).toHaveBeenCalledWith(10, {
        includeDescendants: true,
        keyword: "alice",
        page: 2,
        size: 15,
      }),
    );
    expect(screen.getByRole("heading", { name: "员工与部门管理" })).toBeInTheDocument();
    expect(screen.getByText("“销售部”的成员")).toBeInTheDocument();
    expect(screen.getByLabelText("按部门搜索成员")).toHaveValue("alice");
    expect(screen.getByRole("checkbox", { name: "包含子部门" })).toBeChecked();
    expect(await screen.findAllByText("Alice", { exact: true })).toHaveLength(2);
    expect(screen.getAllByText("销售部", { exact: true })).toHaveLength(2);
    expect(screen.getAllByText("alice", { exact: true })).toHaveLength(1);
    expect(screen.getAllByText("销售", { exact: true })).toHaveLength(1);
  });

  it("does not turn an arbitrary route ID into a department query", async () => {
    const apiClient = {
      getOrganizationDepartmentMembers: vi.fn().mockResolvedValue(memberPage()),
      getOrganizationDepartments: vi.fn().mockResolvedValue(departments),
    } as unknown as ApiClient;

    renderPage(apiClient, "/organization/departments?departmentId=999");

    await waitFor(() => expect(apiClient.getOrganizationDepartments).toHaveBeenCalledOnce());
    expect(apiClient.getOrganizationDepartmentMembers).not.toHaveBeenCalled();
    expect(screen.getByText("请选择当前可见的部门后查看成员。")).toBeInTheDocument();
  });

  it("resets only the department member page when a different tree node is selected", async () => {
    const apiClient = {
      getOrganizationDepartmentMembers: vi.fn().mockResolvedValue(memberPage()),
      getOrganizationDepartments: vi.fn().mockResolvedValue(departments),
    } as unknown as ApiClient;

    renderPage(
      apiClient,
      "/organization/departments?departmentId=10&includeDescendants=true&memberKeyword=alice&memberPage=2",
    );

    await waitFor(() => expect(apiClient.getOrganizationDepartmentMembers).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText("华东组", { exact: true }));

    await waitFor(() =>
      expect(apiClient.getOrganizationDepartmentMembers).toHaveBeenLastCalledWith(11, {
        includeDescendants: true,
        keyword: "alice",
        page: 1,
        size: 15,
      }),
    );
  });

  it("updates the server-side member scope and resets only its page", async () => {
    const apiClient = {
      getOrganizationDepartmentMembers: vi.fn().mockResolvedValue(memberPage()),
      getOrganizationDepartments: vi.fn().mockResolvedValue(departments),
    } as unknown as ApiClient;

    renderPage(
      apiClient,
      "/organization/departments?departmentId=10&memberKeyword=alice&memberPage=2",
    );

    await waitFor(() => expect(apiClient.getOrganizationDepartmentMembers).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("checkbox", { name: "包含子部门" }));

    await waitFor(() =>
      expect(apiClient.getOrganizationDepartmentMembers).toHaveBeenLastCalledWith(10, {
        includeDescendants: true,
        keyword: "alice",
        page: 1,
        size: 15,
      }),
    );
  });
});
