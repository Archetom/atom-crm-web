import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import type { components } from "~/api/generated/schema";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";

import { OaFormsPage } from "./oa-forms-page";

type OaForm = components["schemas"]["OaFormResponse"];

afterEach(cleanup);

function formResponse(overrides: Partial<OaForm> = {}): OaForm {
  return {
    approvalDefinitionId: 4,
    approvalDefinitionName: "标准审批",
    approvalSelections: [],
    code: "leave",
    createdTime: "2026-08-10T00:00:00Z",
    fields: [],
    id: 8,
    name: "默认名称",
    status: "INACTIVE",
    updatedTime: "2026-08-10T00:00:00Z",
    version: 1,
    ...overrides,
  };
}

function renderPage(apiClient: ApiClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MemoryRouter initialEntries={["/oa/forms?page=1&size=15"]}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            adapter: null,
            state: { identityKey: "oa-form-test", mode: "production", ready: true },
            status: "ready",
          }}
        >
          <BootstrapContext.Provider
            value={{
              apiClient,
              authorization: {
                actorId: 7,
                authorities: ["oa-forms:read", "oa-forms:write"],
                dataScopes: {},
                roles: [],
              },
              error: null,
              navigation: [],
              reload: async () => undefined,
              status: "ready",
            }}
          >
            <OaFormsPage />
          </BootstrapContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("OaFormsPage", () => {
  it("reloads the selected form before using its edit baseline", async () => {
    const apiClient = {
      getOaForm: vi.fn().mockResolvedValue(
        formResponse({
          fields: [
            {
              accessLevel: "WRITE",
              builtin: false,
              displayName: "服务端详情字段",
              fieldCode: "server_field",
              fieldType: "TEXT",
              maskType: "NONE",
              options: [],
              required: false,
              searchable: true,
              sortOrder: 10,
              status: "ACTIVE",
            },
          ],
          name: "服务端详情名称",
          version: 4,
        }),
      ),
      getOaFormConfigurationOptions: vi.fn().mockResolvedValue({
        approvalDefinitions: [{ id: 4, name: "标准审批", requiredFieldCodes: [] }],
        fields: [
          {
            displayName: "服务端详情字段",
            fieldCode: "server_field",
            fieldType: "TEXT",
            required: false,
          },
        ],
      }),
      getOaForms: vi.fn().mockResolvedValue({
        objectList: [
          formResponse({
            fields: [],
            name: "列表旧名称",
            version: 3,
          }),
        ],
        pageNum: 1,
        pageSize: 15,
        totalNum: 1,
      }),
    } as unknown as ApiClient;

    renderPage(apiClient);

    await waitFor(() => expect(apiClient.getOaForms).toHaveBeenCalled());
    await screen.findAllByText("列表旧名称");
    const editButton = await waitFor(() => {
      const buttons = screen.queryAllByRole("button", { name: /编\s*辑/u });
      expect(buttons.length).toBeGreaterThan(0);
      return buttons[0]!;
    });
    fireEvent.click(editButton);

    await waitFor(() => expect(apiClient.getOaForm).toHaveBeenCalledWith(8));
    await screen.findByText("编辑 OA 表单");
    expect(screen.getByDisplayValue("服务端详情名称")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("列表旧名称")).not.toBeInTheDocument();
  }, 30_000);
});
