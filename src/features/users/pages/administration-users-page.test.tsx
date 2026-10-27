import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import type { components } from "~/api/generated/schema";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { AdministrationUsersPage } from "./administration-users-page";

type UserPage = components["schemas"]["UserPageResponse"];

afterEach(cleanup);

function userPage(): UserPage {
  return {
    objectList: [
      {
        active: true,
        createdTime: "2026-08-12T10:00:00Z",
        email: "alice@example.com",
        id: 7,
        maskedPhoneNumber: null,
        realName: "Alice",
        status: "ACTIVE",
        statusName: "启用",
        updatedTime: "2026-08-12T10:00:00Z",
        username: "alice",
      },
    ],
    pageNum: 1,
    pageSize: 15,
    totalNum: 1,
  };
}

function RecoveredFilterControl() {
  const [, setSearchParams] = useSearchParams();

  return (
    <button
      onClick={() =>
        setSearchParams({
          email: "recovered@example.com",
          page: "2",
          size: "15",
          status: "LOCKED",
          username: "recovered-user",
        })
      }
      type="button"
    >
      恢复筛选状态
    </button>
  );
}

function renderPage(apiClient: ApiClient, authorities = ["users:read"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MemoryRouter
      initialEntries={["/administration/users?username=alice&email=alice%40example.com"]}
    >
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            adapter: null,
            state: { identityKey: "administration-user-test", mode: "production", ready: true },
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
              navigation: [],
              reload: async () => undefined,
              status: "ready",
            }}
          >
            <RecoveredFilterControl />
            <AdministrationUsersPage />
          </BootstrapContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("AdministrationUsersPage", () => {
  it("keeps search controls synchronized with URL-recovered filters", async () => {
    const apiClient = {
      getUsers: vi.fn().mockResolvedValue(userPage()),
    } as unknown as ApiClient;

    renderPage(apiClient);

    await waitFor(() =>
      expect(apiClient.getUsers).toHaveBeenCalledWith({
        email: "alice@example.com",
        page: 1,
        size: 15,
        status: undefined,
        username: "alice",
      }),
    );
    const usernameSearch = screen.getByLabelText("按用户名搜索");
    const emailSearch = screen.getByLabelText("按邮箱搜索");
    expect(usernameSearch).toHaveValue("alice");
    expect(emailSearch).toHaveValue("alice@example.com");

    fireEvent.change(usernameSearch, { target: { value: "未提交草稿" } });
    expect(usernameSearch).toHaveValue("未提交草稿");
    fireEvent.click(screen.getByRole("button", { name: "恢复筛选状态" }));

    await waitFor(() =>
      expect(apiClient.getUsers).toHaveBeenLastCalledWith({
        email: "recovered@example.com",
        page: 2,
        size: 15,
        status: "LOCKED",
        username: "recovered-user",
      }),
    );
    expect(screen.getByLabelText("按用户名搜索")).toHaveValue("recovered-user");
    expect(screen.getByLabelText("按邮箱搜索")).toHaveValue("recovered@example.com");
  });

  it("submits an explicit user record and then refreshes the server directory", async () => {
    const apiClient = {
      createUser: vi.fn().mockResolvedValue(userPage().objectList[0]),
      getUsers: vi.fn().mockResolvedValue(userPage()),
    } as unknown as ApiClient;

    renderPage(apiClient, ["users:read", "users:write"]);

    fireEvent.click(await screen.findByRole("button", { name: "新建用户" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("用户名"), { target: { value: "new_user" } });
    fireEvent.change(within(dialog).getByLabelText("邮箱"), {
      target: { value: "new.user@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText("初始密码"), {
      target: { value: "password-1234" },
    });
    fireEvent.change(within(dialog).getByLabelText("姓名"), { target: { value: "新用户" } });
    fireEvent.change(within(dialog).getByLabelText("手机号"), {
      target: { value: "+8613800138000" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^创\s*建$/u }));

    await waitFor(() =>
      expect(apiClient.createUser).toHaveBeenCalledWith({
        email: "new.user@example.com",
        password: "password-1234",
        phoneNumber: "+8613800138000",
        realName: "新用户",
        username: "new_user",
      }),
    );
    await waitFor(() => expect(apiClient.getUsers).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "新建用户" })).toBeNull());
  });
});
