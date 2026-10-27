import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "~/api/errors/api-error";

import { BootstrapContext, type BootstrapContextValue } from "../bootstrap/bootstrap-context";

import { AppGate } from "./app-gate";

vi.mock("../layout/responsive-app-layout", () => ({
  ResponsiveAppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

afterEach(cleanup);

function bootstrap(overrides: Partial<BootstrapContextValue>): BootstrapContextValue {
  return {
    apiClient: null,
    authorization: null,
    navigation: [],
    status: "loading",
    error: undefined,
    reload: () => Promise.resolve(),
    ...overrides,
  };
}

function LocationIndicator() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderGate(value: BootstrapContextValue, path = "/crm/customers") {
  return render(
    <BootstrapContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {/* `/login` sits outside the gate, mirroring the public branch in app/root.tsx. */}
          <Route element={<div data-testid="login-route" />} path="/login" />
          <Route element={<AppGate />} path="/crm">
            <Route element={<div data-testid="protected-route" />} path="customers" />
          </Route>
        </Routes>
        <LocationIndicator />
      </MemoryRouter>
    </BootstrapContext.Provider>,
  );
}

describe("AppGate", () => {
  it("does not render a protected route until authorization and navigation resolve", () => {
    renderGate(bootstrap({ status: "loading" }));

    expect(screen.queryByTestId("protected-route")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
    expect(screen.getByLabelText("正在加载应用")).toBeInTheDocument();
  });

  it("does not render a protected route when bootstrap fails", () => {
    renderGate(bootstrap({ status: "error", error: new ApiError(503, "SERVICE_UNAVAILABLE") }));

    expect(screen.queryByTestId("protected-route")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
  });

  it("sends an unauthenticated visitor to login with the attempted path preserved", async () => {
    renderGate(bootstrap({ status: "session-required" }), "/crm/customers");

    expect(await screen.findByTestId("location")).toHaveTextContent("/login");
    expect(screen.queryByTestId("protected-route")).not.toBeInTheDocument();
  });

  it("renders the protected route inside the shell only once bootstrap is ready", () => {
    renderGate(
      bootstrap({
        status: "ready",
        authorization: { actorId: 7, authorities: ["customers:read"], dataScopes: {}, roles: [] },
      }),
    );

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
  });
});
