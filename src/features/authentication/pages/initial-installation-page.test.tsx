import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "~/api/errors/api-error";

import { authenticationApi } from "../api/authentication-api";

import InitialInstallationPage from "./initial-installation-page";

vi.mock("../api/authentication-api", () => ({
  authenticationApi: {
    beginPasswordLogin: vi.fn(),
    confirmPasswordReset: vi.fn(),
    createPasswordSession: vi.fn(),
    getInitialInstallationStatus: vi.fn(),
    initializeTenantAdmin: vi.fn(),
    requestPasswordReset: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/setup"]}>
        <InitialInstallationPage />
        <LocationIndicator />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationIndicator() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InitialInstallationPage", () => {
  it("creates the initial administrator only after the server confirms a fresh installation", async () => {
    vi.mocked(authenticationApi.getInitialInstallationStatus).mockResolvedValue({
      installationRequired: true,
    });
    vi.mocked(authenticationApi.initializeTenantAdmin).mockResolvedValue({
      actorId: 7,
      expiresAt: "2026-08-13T13:00:00Z",
      tenantId: 1,
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "初始化工作空间" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("管理员姓名"), { target: { value: "系统管理员" } });
    fireEvent.change(screen.getByLabelText("登录账号"), { target: { value: "workspace_admin" } });
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "admin@example.test" } });
    fireEvent.change(screen.getByLabelText("设置密码"), { target: { value: "CorrectHorse1" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "CorrectHorse1" } });
    fireEvent.click(screen.getByRole("button", { name: "创建管理员并进入系统" }));

    await waitFor(() =>
      expect(authenticationApi.initializeTenantAdmin).toHaveBeenCalledWith({
        displayName: "系统管理员",
        email: "admin@example.test",
        loginName: "workspace_admin",
        password: "CorrectHorse1",
      }),
    );
    expect(await screen.findByText("工作空间已初始化")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("CorrectHorse1")).not.toBeInTheDocument();
  });

  it("redirects an existing installation away from the setup route", async () => {
    vi.mocked(authenticationApi.getInitialInstallationStatus).mockResolvedValue({
      installationRequired: false,
    });

    renderPage();

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/"));
    expect(screen.queryByRole("button", { name: "创建管理员并进入系统" })).not.toBeInTheDocument();
    expect(authenticationApi.initializeTenantAdmin).not.toHaveBeenCalled();
  });

  it("redirects to the home route when another installation has already won", async () => {
    vi.mocked(authenticationApi.getInitialInstallationStatus).mockResolvedValue({
      installationRequired: true,
    });
    vi.mocked(authenticationApi.initializeTenantAdmin).mockRejectedValue(
      new ApiError(409, "RESOURCE_ALREADY_EXISTS"),
    );

    renderPage();

    await screen.findByRole("heading", { name: "初始化工作空间" });
    fireEvent.change(screen.getByLabelText("管理员姓名"), { target: { value: "系统管理员" } });
    fireEvent.change(screen.getByLabelText("登录账号"), { target: { value: "workspace_admin" } });
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "admin@example.test" } });
    fireEvent.change(screen.getByLabelText("设置密码"), { target: { value: "CorrectHorse1" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "CorrectHorse1" } });
    fireEvent.click(screen.getByRole("button", { name: "创建管理员并进入系统" }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/"));
    expect(screen.queryByRole("button", { name: "创建管理员并进入系统" })).not.toBeInTheDocument();
  });
});
