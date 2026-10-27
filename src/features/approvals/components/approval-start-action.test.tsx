import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { ApprovalStartAction } from "./approval-start-action";

afterEach(cleanup);

function renderAction(apiClient: ApiClient, authorities: readonly string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          adapter: null,
          state: { identityKey: "approval-start-action-test", mode: "production", ready: true },
          status: "ready",
        }}
      >
        <BootstrapContext.Provider
          value={{
            apiClient,
            authorization: { actorId: 7, authorities: [...authorities], dataScopes: {}, roles: [] },
            error: null,
            navigation: [],
            reload: async () => undefined,
            status: "ready",
          }}
        >
          <ApprovalStartAction objectType="LEAD" subjectId={42} />
        </BootstrapContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("ApprovalStartAction", () => {
  it("uses the current feature-owned object type and detail ID only after the permitted action", async () => {
    const apiClient = {
      getApprovalStartOptions: vi.fn().mockResolvedValue({
        objectType: "LEAD",
        options: [],
        subjectId: 42,
      }),
    } as unknown as ApiClient;
    renderAction(apiClient, ["approvals:submit"]);

    fireEvent.click(screen.getByRole("button", { name: "发起审批" }));

    await waitFor(() => expect(apiClient.getApprovalStartOptions).toHaveBeenCalledWith("LEAD", 42));
    expect(await screen.findByText("当前记录没有可发起的审批定义。")).not.toBeNull();
  });

  it("does not render an approval entry without the server-declared submit authority", () => {
    renderAction({} as ApiClient, []);

    expect(screen.queryByRole("button", { name: "发起审批" })).toBeNull();
  });
});
