import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";
import type { NavigationItem } from "~/shared/types/api";

import { ResponsiveAppLayout } from "./responsive-app-layout";

const navigation: NavigationItem[] = [
  {
    children: [],
    code: "crm.contacts",
    order: 1,
    parentCode: null,
    requiredAuthority: "contacts:read",
    route: "/crm/contacts",
    titleKey: "navigation.contacts",
  },
  {
    children: [],
    code: "crm.contactPools",
    order: 2,
    parentCode: null,
    requiredAuthority: "contact-pools:read",
    route: "/crm/contact-pools",
    titleKey: "navigation.contactPools",
  },
  {
    children: [],
    code: "crm.opportunities",
    order: 3,
    parentCode: null,
    requiredAuthority: "opportunities:read",
    route: "/crm/opportunities",
    titleKey: "navigation.opportunities",
  },
];

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string): MediaQueryList => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: query.includes("min-width"),
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    })),
  });
});

afterEach(cleanup);

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MemoryRouter initialEntries={["/crm/contacts"]}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            adapter: null,
            state: { identityKey: "layout-context-test", mode: "production", ready: true },
            status: "ready",
          }}
        >
          <BootstrapContext.Provider
            value={{
              apiClient: null,
              authorization: {
                actorId: 7,
                authorities: ["contacts:read", "contact-pools:read", "opportunities:read"],
                dataScopes: {},
                roles: [],
              },
              error: null,
              navigation,
              reload: async () => undefined,
              status: "ready",
            }}
          >
            <ResponsiveAppLayout>
              <LocationProbe />
            </ResponsiveAppLayout>
          </BootstrapContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("ResponsiveAppLayout", () => {
  it("puts contact pools in the contact context rail without duplicating the primary navigation", () => {
    renderLayout();

    const primaryNavigation = screen.getByRole("navigation", { name: "主模块导航" });
    expect(within(primaryNavigation).getByText("联系人")).toBeInTheDocument();
    expect(within(primaryNavigation).queryByText("联系人公海")).not.toBeInTheDocument();

    expect(screen.getByText("联系人管理")).toBeInTheDocument();
    fireEvent.click(screen.getByText("联系人公海"));

    expect(screen.getByTestId("location")).toHaveTextContent("/crm/contact-pools");
  }, 15_000);
});
