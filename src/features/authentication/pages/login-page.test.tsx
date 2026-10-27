import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "~/api/errors/api-error";

import { authenticationApi } from "../api/authentication-api";

import LoginPage from "./login-page";

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.mocked(authenticationApi.getInitialInstallationStatus).mockResolvedValue({
    installationRequired: false,
  });
});

function LocationIndicator() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderPage(initialEntries = ["/login"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <LoginPage />
        <LocationIndicator />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  it("redirects to setup when the server confirms that no administrator exists", async () => {
    vi.mocked(authenticationApi.getInitialInstallationStatus).mockResolvedValue({
      installationRequired: true,
    });

    renderPage();

    // `findByTestId` resolves as soon as the indicator exists, which is before the
    // installation-status query settles and `<Navigate>` runs. Wait on the content.
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/setup"));
    expect(screen.queryByLabelText("工作区 ID")).not.toBeInTheDocument();
  });

  it("keeps the verified challenge in memory while the user selects a returned tenant", async () => {
    vi.mocked(authenticationApi.beginPasswordLogin).mockResolvedValue({
      loginChallenge: "short-lived-challenge",
      tenants: [{ departmentId: 88, tenantId: 42 }],
    });
    vi.mocked(authenticationApi.createPasswordSession).mockResolvedValue({
      actorId: 7,
      expiresAt: "2026-08-12T13:00:00Z",
      tenantId: 42,
    });

    renderPage(["/login?next=/crm/customers"]);

    fireEvent.change(await screen.findByLabelText("工作区 ID"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("登录账号"), { target: { value: "member_42" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "验证并选择工作区" }));

    expect(await screen.findByRole("heading", { name: "选择工作区" })).toBeInTheDocument();
    expect(authenticationApi.beginPasswordLogin).toHaveBeenCalledWith({
      loginName: "member_42",
      password: "correct-password",
      tenantId: 42,
    });
    expect(screen.queryByDisplayValue("correct-password")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "进入工作空间" }));
    await waitFor(() =>
      expect(authenticationApi.createPasswordSession).toHaveBeenCalledWith({
        loginChallenge: "short-lived-challenge",
        tenantId: 42,
      }),
    );
  });

  it("returns to credential entry when the selected-workspace challenge has expired", async () => {
    vi.mocked(authenticationApi.beginPasswordLogin).mockResolvedValue({
      loginChallenge: "expired-challenge",
      tenants: [{ departmentId: null, tenantId: 42 }],
    });
    vi.mocked(authenticationApi.createPasswordSession).mockRejectedValue(
      new ApiError(401, "AUTH_102"),
    );

    renderPage();

    fireEvent.change(await screen.findByLabelText("工作区 ID"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("登录账号"), { target: { value: "member_42" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "验证并选择工作区" }));
    await screen.findByRole("heading", { name: "选择工作区" });

    fireEvent.click(screen.getByRole("button", { name: "进入工作空间" }));

    expect(await screen.findByText("工作区选择已失效，请重新验证账号和密码。")).toBeInTheDocument();
    expect(screen.getByLabelText("工作区 ID")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "选择工作区" })).not.toBeInTheDocument();
  });
});
