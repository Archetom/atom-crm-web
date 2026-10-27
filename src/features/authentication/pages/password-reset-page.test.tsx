import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authenticationApi } from "../api/authentication-api";

import PasswordResetPage from "./password-reset-page";

vi.mock("../api/authentication-api", () => ({
  authenticationApi: {
    beginPasswordLogin: vi.fn(),
    confirmPasswordReset: vi.fn(),
    createPasswordSession: vi.fn(),
    requestPasswordReset: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PasswordResetPage", () => {
  it("submits the explicit workspace and account without disclosing whether it exists", async () => {
    vi.mocked(authenticationApi.requestPasswordReset).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <PasswordResetPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("工作区 ID"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("登录账号"), { target: { value: "member_42" } });
    fireEvent.click(screen.getByRole("button", { name: "发送重置链接" }));

    await waitFor(() =>
      expect(authenticationApi.requestPasswordReset).toHaveBeenCalledWith({
        loginName: "member_42",
        tenantId: 42,
      }),
    );
    expect(await screen.findByText("请查收重置邮件")).toBeInTheDocument();
  });
});
