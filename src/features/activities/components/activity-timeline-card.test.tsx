import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "~/api/client/api-client";
import { AuthContext } from "~/app/auth/auth-context";
import { BootstrapContext } from "~/app/bootstrap/bootstrap-context";
import type { ActivitySubjectType } from "../model/activity-timeline";
import { ActivityTimelineCard } from "./activity-timeline-card";

afterEach(cleanup);

function renderTimeline(
  subjectId: number,
  subjectType: ActivitySubjectType,
  apiClient: ApiClient,
  authorities: string[] = ["activities:read"],
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          adapter: null,
          state: { identityKey: "activity-timeline-test", mode: "production", ready: true },
          status: "ready",
        }}
      >
        <BootstrapContext.Provider
          value={{
            apiClient,
            authorization: {
              actorId: 7,
              authorities,
              dataScopes: {},
              roles: [],
            },
            error: null,
            navigation: [],
            reload: async () => undefined,
            status: "ready",
          }}
        >
          <ActivityTimelineCard subjectId={subjectId} subjectType={subjectType} />
        </BootstrapContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("ActivityTimelineCard", () => {
  it.each<readonly [ActivitySubjectType, number]>([
    ["LEAD", 11],
    ["CONTACT", 12],
    ["OPPORTUNITY", 13],
    ["CONTRACT", 14],
    ["INVOICE", 15],
    ["RECEIVABLE", 16],
    ["RECEIVABLE_PLAN", 17],
  ])(
    "queries the current %s detail subject without a customer fallback",
    async (subjectType, subjectId) => {
      const apiClient = {
        getActivities: vi
          .fn()
          .mockResolvedValue({ objectList: [], pageNum: 1, pageSize: 20, totalNum: 0 }),
      } as unknown as ApiClient;

      renderTimeline(subjectId, subjectType, apiClient);

      expect(screen.getByText("跟进记录")).not.toBeNull();
      await waitFor(() =>
        expect(apiClient.getActivities).toHaveBeenCalledWith({
          page: 1,
          size: 20,
          subjectId,
          subjectType,
        }),
      );
    },
  );

  it("offers an optional next-contact time when composing a follow-up", async () => {
    const apiClient = {
      getActivities: vi
        .fn()
        .mockResolvedValue({ objectList: [], pageNum: 1, pageSize: 20, totalNum: 0 }),
      getActivityMethods: vi.fn().mockResolvedValue([{ label: "电话", value: "CALL" }]),
    } as unknown as ApiClient;

    renderTimeline(12, "CONTACT", apiClient, ["activities:read", "activities:write"]);

    fireEvent.click(screen.getByRole("button", { name: "写跟进" }));

    expect(await screen.findByLabelText("下次联系时间")).not.toBeNull();
    await waitFor(() => expect(apiClient.getActivityMethods).toHaveBeenCalledTimes(1));
  });
});
