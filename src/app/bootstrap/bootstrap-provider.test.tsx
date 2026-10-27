import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import { createApiClient } from "~/api/client/api-client";
import type { AuthAdapter, AuthBootstrapState } from "../auth/auth-adapter";
import { AuthContext, type AuthContextValue } from "../auth/auth-context";

import { useBootstrap } from "./bootstrap-context";
import { BootstrapProvider } from "./bootstrap-provider";

vi.mock("~/api/client/api-client", () => ({ createApiClient: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const adapter = {
  bootstrap: () => Promise.resolve({} as AuthBootstrapState),
  apply: (request: RequestInit) => Promise.resolve(request),
  handleUnauthorized: () => Promise.resolve(),
} satisfies AuthAdapter;

function authValue(identityKey: string): AuthContextValue {
  return {
    adapter,
    state: { mode: "production", ready: true, identityKey },
    status: "ready",
  };
}

function BootstrapStatus() {
  const { status } = useBootstrap();
  return <output data-testid="status">{status}</output>;
}

function setup(identityKey: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const clear = vi.spyOn(queryClient, "clear");
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue(identityKey)}>
        <BootstrapProvider>
          <BootstrapStatus />
        </BootstrapProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

  function rerenderWithIdentity(nextIdentityKey: string) {
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue(nextIdentityKey)}>
          <BootstrapProvider>
            <BootstrapStatus />
          </BootstrapProvider>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
  }

  return { clear, rerenderWithIdentity };
}

describe("BootstrapProvider identity isolation", () => {
  it("discards every cached entry when the acting identity changes", async () => {
    vi.mocked(createApiClient).mockReturnValue({
      getAuthorization: () => Promise.resolve({ actorId: 1, authorities: [] }),
      getNavigation: () => Promise.resolve([]),
    } as unknown as ApiClient);

    const { clear, rerenderWithIdentity } = setup("development:900001:900001");

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(clear).not.toHaveBeenCalled();

    rerenderWithIdentity("development:900002:900002");

    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
  });

  it("keeps the cache when the identity is unchanged", async () => {
    vi.mocked(createApiClient).mockReturnValue({
      getAuthorization: () => Promise.resolve({ actorId: 1, authorities: [] }),
      getNavigation: () => Promise.resolve([]),
    } as unknown as ApiClient);

    const { clear, rerenderWithIdentity } = setup("development:900001:900001");

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    rerenderWithIdentity("development:900001:900001");

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(clear).not.toHaveBeenCalled();
  });

  it("reports an error status without exposing the failure to children", async () => {
    vi.mocked(createApiClient).mockReturnValue({
      getAuthorization: () => Promise.reject(new Error("unavailable")),
      getNavigation: () => Promise.resolve([]),
    } as unknown as ApiClient);

    setup("development:900001:900001");

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
  });
});
