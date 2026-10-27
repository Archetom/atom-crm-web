import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { CustomerListPage } from "./customer-list-page";

afterEach(cleanup);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MemoryRouter initialEntries={["/crm/customers"]}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            adapter: null,
            state: { identityKey: "customer-list-test", mode: "production", ready: true },
            status: "ready",
          }}
        >
          <BootstrapContext.Provider
            value={{
              apiClient: null,
              authorization: {
                actorId: 7,
                authorities: ["customers:read"],
                dataScopes: {},
                roles: [],
              },
              error: null,
              navigation: [],
              reload: async () => undefined,
              status: "ready",
            }}
          >
            <CustomerListPage />
          </BootstrapContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("CustomerListPage", () => {
  it("keeps the read-authorized duplicate check in the list toolbar and opens the existing dialog", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "查重" }));

    const duplicateDialog = screen.getByRole("dialog");
    expect(duplicateDialog).toContainElement(screen.getByRole("textbox", { name: "客户名称" }));
    expect(duplicateDialog).toHaveTextContent("仅检查当前成员有权查看的客户范围");
  }, 15_000);
});
