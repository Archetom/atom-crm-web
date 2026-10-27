import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authenticationApi } from "../api/authentication-api";

import PasswordResetConfirmPage from "./password-reset-confirm-page";

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

describe("PasswordResetConfirmPage", () => {
  it("uses the current reset-link token only for the password update request", async () => {
    vi.mocked(authenticationApi.confirmPasswordReset).mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/password-reset/confirm?token=single-use-token"]}>
        <PasswordResetConfirmPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("新密码"), { target: { value: "a-new-long-password" } });
    fireEvent.change(screen.getByLabelText("确认新密码"), {
      target: { value: "a-new-long-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新密码" }));

    await waitFor(() =>
      expect(authenticationApi.confirmPasswordReset).toHaveBeenCalledWith({
        newPassword: "a-new-long-password",
        resetToken: "single-use-token",
      }),
    );
    expect(await screen.findByText("密码已更新")).toBeInTheDocument();
  });
});
