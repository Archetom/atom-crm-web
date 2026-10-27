import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import type { components } from "~/api/generated/schema";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { SavedViewControls } from "./saved-view-controls";

type FieldDefinition = components["schemas"]["FieldDefinitionResponse"];
type SavedView = components["schemas"]["SavedViewResponse"];

afterEach(cleanup);

const fieldDefinition: FieldDefinition = {
  builtin: true,
  code: "customer_name",
  createdTime: "2026-08-11T00:00:00Z",
  displayName: "客户名称",
  displayOrder: 1,
  fieldType: "TEXT",
  filterOperators: [{ code: "CONTAINS", maximumValueCount: 1, minimumValueCount: 1 }],
  id: 1,
  objectType: "CUSTOMER",
  options: [],
  required: true,
  searchable: true,
  status: "ACTIVE",
  unique: false,
  updatedTime: "2026-08-11T00:00:00Z",
  version: 1,
};

function renderControls(
  apiClient: ApiClient,
  options: {
    onTemporaryConditionsChange?: (
      conditions: components["schemas"]["FilterConditionRequest"][],
    ) => void;
    selection?: number | null;
  } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          adapter: null,
          state: { identityKey: "saved-view-controls-test", mode: "production", ready: true },
          status: "ready",
        }}
      >
        <BootstrapContext.Provider
          value={{
            apiClient,
            authorization: {
              actorId: 7,
              authorities: ["saved-views:read", "saved-views:write"],
              dataScopes: {},
              roles: [],
            },
            error: null,
            navigation: [],
            reload: async () => undefined,
            status: "ready",
          }}
        >
          <SavedViewControls
            entityLabel="客户"
            objectType="CUSTOMER"
            selection={options.selection ?? null}
            onSelectionChange={vi.fn()}
            onTemporaryConditionsChange={options.onTemporaryConditionsChange ?? vi.fn()}
          />
        </BootstrapContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("SavedViewControls", () => {
  it("opens advanced conditions directly and keeps saved-view management available", async () => {
    const apiClient = {
      listFieldDefinitions: vi.fn().mockResolvedValue([fieldDefinition]),
      listSavedViews: vi.fn().mockResolvedValue([]),
    } as unknown as ApiClient;

    renderControls(apiClient);

    fireEvent.click(screen.getByRole("button", { name: "高级筛选" }));

    const advancedDialog = await screen.findByRole("dialog");
    expect(advancedDialog).toHaveTextContent("高级筛选");
    await waitFor(() =>
      expect(apiClient.listFieldDefinitions).toHaveBeenCalledWith("CUSTOMER", false),
    );
    expect(
      within(advancedDialog).getByRole("button", { name: "添加筛选条件" }),
    ).toBeInTheDocument();
    expect(
      within(advancedDialog).getByRole("checkbox", { name: "保存为筛选方案" }),
    ).toBeInTheDocument();
    fireEvent.click(within(advancedDialog).getByRole("checkbox", { name: "保存为筛选方案" }));
    expect(
      within(advancedDialog).getByRole("checkbox", { name: "设置为默认" }),
    ).toBeInTheDocument();
    fireEvent.click(within(advancedDialog).getByRole("button", { name: "添加筛选条件" }));
    expect(
      await within(advancedDialog).findByRole("checkbox", { name: "在列表中外露此条件" }),
    ).toBeInTheDocument();
    expect(within(advancedDialog).getByRole("button", { name: /确\s*定/u })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "临时应用筛选" })).not.toBeInTheDocument();

    fireEvent.click(within(advancedDialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "筛选方案" }));

    const managerDialog = await screen.findByRole("dialog");
    expect(managerDialog).toHaveTextContent("客户筛选方案");
    expect(
      within(managerDialog).getByRole("button", { name: /新建筛选方案/u }),
    ).toBeInTheDocument();
  }, 15_000);

  it("uses server-published exposure metadata to apply and clear expanded filters", async () => {
    const savedView: SavedView = {
      conditions: [
        {
          exposed: true,
          fieldCode: "customer_name",
          operator: "CONTAINS",
          values: ["Atom"],
        },
      ],
      createdTime: "2026-08-11T00:00:00Z",
      defaultView: false,
      hidden: false,
      id: 9,
      name: "重点客户",
      objectType: "CUSTOMER",
      sortOrder: 0,
      updatedTime: "2026-08-11T00:00:00Z",
      version: 1,
    };
    const onTemporaryConditionsChange = vi.fn();
    const apiClient = {
      listFieldDefinitions: vi.fn().mockResolvedValue([fieldDefinition]),
      listSavedViews: vi.fn().mockResolvedValue([savedView]),
    } as unknown as ApiClient;

    renderControls(apiClient, { onTemporaryConditionsChange, selection: savedView.id });

    const expandButton = await screen.findByRole("button", { name: "展开筛选" });
    fireEvent.click(expandButton);

    await waitFor(() =>
      expect(apiClient.listFieldDefinitions).toHaveBeenCalledWith("CUSTOMER", false),
    );
    expect(await screen.findByText("客户名称：包含")).toBeInTheDocument();
    expect(onTemporaryConditionsChange).toHaveBeenLastCalledWith([
      { fieldCode: "customer_name", operator: "CONTAINS", values: ["Atom"] },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "清除外露筛选" }));
    expect(onTemporaryConditionsChange).toHaveBeenLastCalledWith([]);

    fireEvent.click(screen.getByRole("button", { name: "收起筛选" }));
    expect(onTemporaryConditionsChange).toHaveBeenLastCalledWith([]);
  }, 15_000);

  it("creates a default saved view from the direct advanced-filter flow", async () => {
    const savedView: SavedView = {
      conditions: [],
      createdTime: "2026-08-11T00:00:00Z",
      defaultView: false,
      hidden: false,
      id: 10,
      name: "默认筛选",
      objectType: "CUSTOMER",
      sortOrder: 0,
      updatedTime: "2026-08-11T00:00:00Z",
      version: 1,
    };
    const apiClient = {
      createSavedView: vi.fn().mockResolvedValue(savedView),
      listFieldDefinitions: vi.fn().mockResolvedValue([fieldDefinition]),
      listSavedViews: vi.fn().mockResolvedValue([]),
      setDefaultSavedView: vi.fn().mockResolvedValue({ ...savedView, defaultView: true }),
    } as unknown as ApiClient;

    renderControls(apiClient);
    fireEvent.click(screen.getByRole("button", { name: "高级筛选" }));

    const advancedDialog = await screen.findByRole("dialog");
    fireEvent.click(within(advancedDialog).getByRole("checkbox", { name: "保存为筛选方案" }));
    fireEvent.click(await within(advancedDialog).findByRole("checkbox", { name: "设置为默认" }));
    fireEvent.change(within(advancedDialog).getByLabelText("筛选方案名称"), {
      target: { value: savedView.name },
    });
    fireEvent.click(within(advancedDialog).getByRole("button", { name: /确\s*定/u }));

    await waitFor(() =>
      expect(apiClient.createSavedView).toHaveBeenCalledWith({
        conditions: [],
        hidden: false,
        name: savedView.name,
        objectType: "CUSTOMER",
        sortOrder: 0,
      }),
    );
    await waitFor(() => expect(apiClient.setDefaultSavedView).toHaveBeenCalledWith(10, 1));
  });
});
