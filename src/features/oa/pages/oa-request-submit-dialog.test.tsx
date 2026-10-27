import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import type { components } from "~/api/generated/schema";

import { OaRequestSubmitDialog } from "./oa-request-submit-dialog";

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
    name: "列表投影表单",
    status: "ACTIVE",
    updatedTime: "2026-08-10T00:00:00Z",
    version: 3,
    ...overrides,
  };
}

function renderDialog(apiClient: ApiClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <OaRequestSubmitDialog
        apiClient={apiClient}
        identityKey="oa-request-form-test"
        onCancel={() => undefined}
        onSubmitted={() => undefined}
        open
      />
    </QueryClientProvider>,
  );
}

describe("OaRequestSubmitDialog", () => {
  it("reloads the selected available form before rendering request fields", async () => {
    const apiClient = {
      getAvailableOaForm: vi.fn().mockResolvedValue(
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
              required: true,
              searchable: true,
              sortOrder: 10,
              status: "ACTIVE",
            },
          ],
          version: 4,
        }),
      ),
      getAvailableOaForms: vi.fn().mockResolvedValue([
        formResponse({
          fields: [
            {
              accessLevel: "WRITE",
              builtin: false,
              displayName: "列表缓存字段",
              fieldCode: "stale_field",
              fieldType: "TEXT",
              maskType: "NONE",
              options: [],
              required: true,
              searchable: true,
              sortOrder: 10,
              status: "ACTIVE",
            },
          ],
        }),
      ]),
    } as unknown as ApiClient;

    renderDialog(apiClient);

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "OA 表单" }));
    fireEvent.click(await screen.findByTitle("列表投影表单"));

    await waitFor(() => expect(apiClient.getAvailableOaForm).toHaveBeenCalledWith(8));
    expect(await screen.findByText("服务端详情字段")).toBeInTheDocument();
    expect(screen.queryByText("列表缓存字段")).not.toBeInTheDocument();
  }, 30_000);
});
