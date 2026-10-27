import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "~/api/errors/api-error";
import type { AuthAdapter } from "~/app/auth/auth-adapter";

import { createApiClient } from "./api-client";

const auth: AuthAdapter = {
  bootstrap: async () => ({ mode: "production", ready: true, identityKey: "session" }),
  apply: async (request) => request,
  handleUnauthorized: async () => undefined,
};

const NativeRequest = globalThis.Request;

beforeEach(() => {
  class RelativeRequest extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(
        typeof input === "string" && input.startsWith("/")
          ? new URL(input, "http://localhost")
          : input,
        init,
      );
    }
  }

  vi.stubGlobal("Request", RelativeRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("field metadata API client", () => {
  it("uses generated marketing activity list and versioned lifecycle contracts", async () => {
    const activity = {
      createdByActorId: 8,
      createdTime: "2026-08-08T12:00:00",
      endTime: "2026-09-01T18:00:00",
      id: 12,
      name: "秋季活动",
      oneSubmissionPerUser: true,
      participantActorIds: [8],
      relatedObjectType: "LEAD",
      startTime: "2026-09-01T09:00:00",
      status: "ACTIVE",
      updatedTime: "2026-08-08T12:00:00",
      version: 3,
    };
    const responses = [
      {
        activityTypes: [{ code: "SEMINAR", displayName: "研讨会" }],
        defaultRelatedObjectType: "CUSTOMER",
        relatedObjectTypes: [
          { code: "CUSTOMER", displayName: "客户", supportsMarketingForm: true },
          { code: "CONTACT", displayName: "联系人", supportsMarketingForm: false },
          { code: "LEAD", displayName: "线索", supportsMarketingForm: true },
        ],
      },
      { objectList: [activity], pageNum: 2, pageSize: 15, totalNum: 16 },
      activity,
      activity,
      { ...activity, version: 4 },
      null,
      null,
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        const body = responses.shift();
        return new Response(body === null ? null : JSON.stringify(body), {
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);
    const request = {
      endTime: "2026-09-01T18:00:00",
      name: "秋季活动",
      oneSubmissionPerUser: true,
      participantActorIds: [8],
      relatedObjectType: "LEAD" as const,
      startTime: "2026-09-01T09:00:00",
    };

    await expect(client.getMarketingActivityConfigurationOptions()).resolves.toEqual({
      activityTypes: [{ code: "SEMINAR", displayName: "研讨会" }],
      defaultRelatedObjectType: "CUSTOMER",
      relatedObjectTypes: [
        { code: "CUSTOMER", displayName: "客户", supportsMarketingForm: true },
        { code: "CONTACT", displayName: "联系人", supportsMarketingForm: false },
        { code: "LEAD", displayName: "线索", supportsMarketingForm: true },
      ],
    });
    await expect(
      client.getMarketingActivities({
        keyword: "秋季",
        page: 2,
        relatedObjectType: "LEAD",
        size: 15,
      }),
    ).resolves.toMatchObject({ totalNum: 16 });
    await expect(client.getMarketingActivity(12)).resolves.toMatchObject({ id: 12 });
    await client.createMarketingActivity(request);
    await client.updateMarketingActivity(12, { ...request, version: 3 });
    await expect(
      client.deleteMarketingActivities({ activities: [{ activityId: 12, version: 4 }] }),
    ).resolves.toBeUndefined();
    await expect(client.deleteMarketingActivity(12, 4)).resolves.toBeUndefined();

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toBe(
      "http://localhost/api/v1/marketing-activities/configuration-options",
    );
    expect(requests[1]?.url).toBe(
      "http://localhost/api/v1/marketing-activities?keyword=%E7%A7%8B%E5%AD%A3&page=2&relatedObjectType=LEAD&size=15",
    );
    expect(requests[2]?.url).toBe("http://localhost/api/v1/marketing-activities/12");
    expect(requests[3]?.method).toBe("POST");
    await expect(requests[3]?.json()).resolves.toEqual(request);
    expect(requests[4]?.method).toBe("PUT");
    await expect(requests[4]?.json()).resolves.toEqual({ ...request, version: 3 });
    expect(requests[5]?.method).toBe("POST");
    expect(requests[5]?.url).toBe("http://localhost/api/v1/marketing-activities/batch-delete");
    await expect(requests[5]?.json()).resolves.toEqual({
      activities: [{ activityId: 12, version: 4 }],
    });
    expect(requests[6]?.url).toBe("http://localhost/api/v1/marketing-activities/12?version=4");
  });

  it("requests the generated target-specific marketing-form field catalog", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ fields: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(
      client.getMarketingFormConfigurationOptions(undefined, "CUSTOMER"),
    ).resolves.toEqual({
      fields: [],
    });

    const [input] = fetch.mock.calls[0] ?? [];
    expect(new Request(input as RequestInfo).url).toBe(
      "http://localhost/api/v1/marketing-forms/configuration-options?targetObjectType=CUSTOMER",
    );
  });

  it("uses form-scoped OA candidate and file-draft contracts", async () => {
    const responses = [
      { objectList: [], pageNum: 1, pageSize: 20, totalNum: 0 },
      { objectList: [], pageNum: 1, pageSize: 50, totalNum: 0 },
      {
        expiresAt: "2099-01-01T00:00:00Z",
        formId: 8,
        formVersion: 3,
        id: 12,
        objectType: "OA_REQUEST",
        version: 0,
      },
      {
        displayName: "行程单.pdf",
        fileId: 23,
        mediaType: "application/pdf",
        size: 120,
        status: "UPLOADED",
      },
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await client.getOaFormFieldCandidates(8, "delegate", { keyword: "张", page: 1, size: 20 });
    await client.getOaFormApprovalSelectionCandidates(8, "selected-reviewer", {
      keyword: "张",
      page: 1,
      size: 50,
    });
    await expect(client.createOaFileFieldDraft(8, 3)).resolves.toMatchObject({ id: 12 });
    await expect(client.getOaFileFieldUploadStatus(12, "itinerary", 23)).resolves.toMatchObject({
      fileId: 23,
      status: "UPLOADED",
    });

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toContain(
      "/api/v1/oa/forms/available/8/fields/delegate/candidates?keyword=%E5%BC%A0&page=1&size=20",
    );
    expect(requests[1]?.url).toContain(
      "/api/v1/oa/forms/available/8/approval-selections/selected-reviewer/candidates?keyword=%E5%BC%A0&page=1&size=50",
    );
    expect(requests[2]?.url).toBe("http://localhost/api/v1/oa/forms/8/file-field-drafts");
    await expect(requests[2]?.json()).resolves.toEqual({ formVersion: 3 });
    expect(requests[3]?.url).toBe(
      "http://localhost/api/v1/file-field-drafts/12/fields/itinerary/files/23/upload-status",
    );
  });

  it("uploads a customer FILE only through a customer-scoped draft and confirmed status", async () => {
    const observed: {
      body: unknown;
      credentials: RequestCredentials;
      method: string;
      url: string;
    }[] = [];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async (input, init) => {
        const request = new Request(input, init);
        observed.push({
          body:
            request.method === "POST" &&
            request.headers.get("content-type")?.includes("application/json")
              ? await request.clone().json()
              : undefined,
          credentials: request.credentials,
          method: request.method,
          url: request.url,
        });
        if (request.url === "http://localhost/api/v1/file-field-drafts") {
          return new Response(
            JSON.stringify({
              expiresAt: "2099-01-01T00:00:00Z",
              id: 31,
              objectType: "CUSTOMER",
              version: 0,
            }),
            { headers: { "Content-Type": "application/json" }, status: 201 },
          );
        }
        if (
          request.url ===
          "http://localhost/api/v1/file-field-drafts/31/fields/qualification/upload-intents"
        ) {
          return new Response(
            JSON.stringify({
              draftId: 31,
              expiresAt: "2099-01-01T00:00:00Z",
              fieldCode: "qualification",
              fileId: 41,
              requiredHeaders: { "x-upload-token": "signed-token" },
              uploadMethod: "PUT",
              uploadUrl: "https://upload.example.test/customer-file/41",
            }),
            { headers: { "Content-Type": "application/json" }, status: 201 },
          );
        }
        if (request.url === "https://upload.example.test/customer-file/41") {
          return new Response(null);
        }
        if (
          request.url ===
          "http://localhost/api/v1/file-field-drafts/31/fields/qualification/files/41/upload-status"
        ) {
          return new Response(
            JSON.stringify({
              displayName: "资质证明.pdf",
              fileId: 41,
              mediaType: "application/pdf",
              size: 8,
              status: "UPLOADED",
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    const draft = await client.createCrmFileFieldDraft("CUSTOMER");
    await expect(
      client.uploadCrmFileFieldFiles(draft, "qualification", [
        new File(["contents"], "资质证明.pdf", { type: "application/pdf" }),
      ]),
    ).resolves.toMatchObject({
      draft: { id: 31, objectType: "CUSTOMER" },
      files: [{ fileId: 41, status: "UPLOADED" }],
    });

    expect(observed).toMatchObject([
      {
        body: { objectType: "CUSTOMER" },
        method: "POST",
        url: "http://localhost/api/v1/file-field-drafts",
      },
      {
        body: {
          declaredMediaType: "application/pdf",
          displayName: "资质证明.pdf",
          expectedBytes: 8,
        },
        method: "POST",
        url: "http://localhost/api/v1/file-field-drafts/31/fields/qualification/upload-intents",
      },
      {
        credentials: "omit",
        method: "PUT",
        url: "https://upload.example.test/customer-file/41",
      },
      {
        method: "GET",
        url: "http://localhost/api/v1/file-field-drafts/31/fields/qualification/files/41/upload-status",
      },
    ]);
  });

  it("queries OA announcement audiences through the server-authorized catalog", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            objectList: [{ displayName: "华东销售部", id: 9 }],
            pageNum: 1,
            pageSize: 50,
            totalNum: 1,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).getOaAnnouncementAudienceCandidates({
        keyword: "华东",
        page: 1,
        size: 50,
        type: "DEPARTMENT_SUBTREE",
      }),
    ).resolves.toMatchObject({ objectList: [{ id: 9 }] });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/oa/announcements/audience-candidates?keyword=%E5%8D%8E%E4%B8%9C&page=1&size=50&type=DEPARTMENT_SUBTREE",
    );
  });

  it("reads and writes dashboard preferences through the generated versioned contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            timeRange: "CURRENT_MONTH",
            dataScope: "SELF",
            hiddenModules: [],
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getDashboardPreference()).resolves.toMatchObject({
      dataScope: "SELF",
      hiddenModules: [],
      timeRange: "CURRENT_MONTH",
      version: 3,
    });
    await client.updateDashboardPreference({
      dataScope: "SELF",
      hiddenModules: [],
      timeRange: "CURRENT_MONTH",
      version: 3,
    });

    const [readRequest, updateRequest] = fetch.mock.calls.map(
      ([input]) => new Request(input as RequestInfo),
    );
    expect(readRequest?.method).toBe("GET");
    expect(readRequest?.url).toBe("http://localhost/api/v1/dashboard/preferences");
    expect(updateRequest?.method).toBe("PUT");
    expect(updateRequest?.url).toBe("http://localhost/api/v1/dashboard/preferences");
    await expect(updateRequest?.json()).resolves.toEqual({
      dataScope: "SELF",
      hiddenModules: [],
      timeRange: "CURRENT_MONTH",
      version: 3,
    });
  });

  it("uses member-scoped monthly performance-target contracts with atomic imports and optimistic versions", async () => {
    const target = {
      amount: 80000,
      createdTime: "2026-08-10T10:00:00",
      id: 42,
      memberId: 7,
      metric: "ACTIVE_CONTRACT",
      targetMonth: 8,
      targetYear: 2026,
      updatedTime: "2026-08-10T10:00:00",
      version: 3,
    };
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(target), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await client.getPerformanceTargets({ memberId: 7, targetYear: 2026 });
    await client.createPerformanceTarget({
      amount: 80000,
      memberId: 7,
      metric: "ACTIVE_CONTRACT",
      targetMonth: 8,
      targetYear: 2026,
    });
    await client.importPerformanceTargets({
      metric: "ACTIVE_CONTRACT",
      targets: [
        { amount: 80000, memberId: 7, targetMonth: 8, targetYear: 2026 },
        { amount: 90000, memberId: 7, targetMonth: 9, targetYear: 2026 },
      ],
    });
    await client.updatePerformanceTarget(42, { amount: 90000, version: 3 });
    await client.deletePerformanceTarget(42, 4);

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.method).toBe("GET");
    expect(requests[0]?.url).toBe(
      "http://localhost/api/v1/dashboard/performance-targets?memberId=7&targetYear=2026",
    );
    expect(requests[1]?.method).toBe("POST");
    await expect(requests[1]?.json()).resolves.toEqual({
      amount: 80000,
      memberId: 7,
      metric: "ACTIVE_CONTRACT",
      targetMonth: 8,
      targetYear: 2026,
    });
    expect(requests[2]?.method).toBe("POST");
    expect(requests[2]?.url).toBe("http://localhost/api/v1/dashboard/performance-targets/import");
    await expect(requests[2]?.json()).resolves.toEqual({
      metric: "ACTIVE_CONTRACT",
      targets: [
        { amount: 80000, memberId: 7, targetMonth: 8, targetYear: 2026 },
        { amount: 90000, memberId: 7, targetMonth: 9, targetYear: 2026 },
      ],
    });
    expect(requests[3]?.method).toBe("PUT");
    expect(requests[3]?.url).toBe("http://localhost/api/v1/dashboard/performance-targets/42");
    await expect(requests[3]?.json()).resolves.toEqual({ amount: 90000, version: 3 });
    expect(requests[4]?.method).toBe("DELETE");
    expect(requests[4]?.url).toBe(
      "http://localhost/api/v1/dashboard/performance-targets/42?version=4",
    );
  });

  it("uses department period target contracts with atomic imports and optimistic versions", async () => {
    const target = {
      amount: 120000,
      createdTime: "2026-08-11T10:00:00",
      departmentId: 7,
      id: 43,
      metric: "ACTIVE_CONTRACT",
      period: "QUARTER",
      periodNumber: 3,
      targetYear: 2026,
      updatedTime: "2026-08-11T10:00:00",
      version: 3,
    };
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(target), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await client.getDepartmentPerformanceTargets({ departmentId: 7, targetYear: 2026 });
    await client.createDepartmentPerformanceTarget({
      amount: 120000,
      departmentId: 7,
      metric: "ACTIVE_CONTRACT",
      period: "QUARTER",
      periodNumber: 3,
      targetYear: 2026,
    });
    await client.batchUpsertDepartmentPerformanceTargets({
      departmentId: 7,
      metric: "ACTIVE_CONTRACT",
      targetYear: 2026,
      targets: [
        { amount: 480000, period: "YEAR", periodNumber: 1 },
        { amount: 120000, period: "QUARTER", periodNumber: 3, version: 3 },
      ],
    });
    await client.importDepartmentPerformanceTargets({
      metric: "ACTIVE_CONTRACT",
      targets: [
        { amount: 480000, departmentId: 7, period: "YEAR", periodNumber: 1, targetYear: 2026 },
        {
          amount: 130000,
          departmentId: 7,
          period: "QUARTER",
          periodNumber: 3,
          targetYear: 2026,
        },
      ],
    });
    await client.updateDepartmentPerformanceTarget(43, { amount: 130000, version: 3 });
    await client.deleteDepartmentPerformanceTarget(43, 4);

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.method).toBe("GET");
    expect(requests[0]?.url).toBe(
      "http://localhost/api/v1/dashboard/department-performance-targets?departmentId=7&targetYear=2026",
    );
    expect(requests[1]?.method).toBe("POST");
    await expect(requests[1]?.json()).resolves.toEqual({
      amount: 120000,
      departmentId: 7,
      metric: "ACTIVE_CONTRACT",
      period: "QUARTER",
      periodNumber: 3,
      targetYear: 2026,
    });
    expect(requests[2]?.method).toBe("PUT");
    expect(requests[2]?.url).toBe(
      "http://localhost/api/v1/dashboard/department-performance-targets/batch",
    );
    await expect(requests[2]?.json()).resolves.toEqual({
      departmentId: 7,
      metric: "ACTIVE_CONTRACT",
      targetYear: 2026,
      targets: [
        { amount: 480000, period: "YEAR", periodNumber: 1 },
        { amount: 120000, period: "QUARTER", periodNumber: 3, version: 3 },
      ],
    });
    expect(requests[3]?.method).toBe("POST");
    expect(requests[3]?.url).toBe(
      "http://localhost/api/v1/dashboard/department-performance-targets/import",
    );
    await expect(requests[3]?.json()).resolves.toEqual({
      metric: "ACTIVE_CONTRACT",
      targets: [
        { amount: 480000, departmentId: 7, period: "YEAR", periodNumber: 1, targetYear: 2026 },
        {
          amount: 130000,
          departmentId: 7,
          period: "QUARTER",
          periodNumber: 3,
          targetYear: 2026,
        },
      ],
    });
    expect(requests[4]?.method).toBe("PUT");
    expect(requests[4]?.url).toBe(
      "http://localhost/api/v1/dashboard/department-performance-targets/43",
    );
    await expect(requests[4]?.json()).resolves.toEqual({ amount: 130000, version: 3 });
    expect(requests[5]?.method).toBe("DELETE");
    expect(requests[5]?.url).toBe(
      "http://localhost/api/v1/dashboard/department-performance-targets/43?version=4",
    );
  });

  it("uses the authorized menu recovery tree for versioned navigation preferences", async () => {
    const preference = {
      availableItems: [
        {
          children: [],
          code: "workspace.home",
          order: 1,
          parentCode: null,
          requiredAuthority: "navigation:read",
          route: "/",
          titleKey: "navigation.home",
        },
      ],
      hiddenCodes: ["workspace.home"],
      orderedCodes: ["workspace.home"],
      version: 3,
    };
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(preference), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getNavigationPreference()).resolves.toMatchObject({
      availableItems: [{ code: "workspace.home" }],
      hiddenCodes: ["workspace.home"],
      version: 3,
    });
    await client.updateNavigationPreference({
      hiddenCodes: [],
      orderedCodes: ["workspace.home"],
      version: 3,
    });

    const [readRequest, updateRequest] = fetch.mock.calls.map(
      ([input]) => new Request(input as RequestInfo),
    );
    expect(readRequest?.method).toBe("GET");
    expect(readRequest?.url).toBe("http://localhost/api/v1/navigation/preferences");
    expect(updateRequest?.method).toBe("PUT");
    expect(updateRequest?.url).toBe("http://localhost/api/v1/navigation/preferences");
    await expect(updateRequest?.json()).resolves.toEqual({
      hiddenCodes: [],
      orderedCodes: ["workspace.home"],
      version: 3,
    });
  });

  it("uses the generated embedded-page contracts without browser-side URL rendering", async () => {
    const response = {
      createdByActorId: 9,
      createdTime: "2026-07-30T00:00:00Z",
      id: 12,
      name: "客户画像",
      objectType: "CUSTOMER",
      platform: "WEB",
      sortOrder: 2,
      status: "INACTIVE",
      updatedTime: "2026-07-30T00:00:00Z",
      urlTemplate: "https://portal.example.test/customers/{recordId}",
      version: 3,
    };
    const responses = [
      {
        objectTypes: [{ code: "CUSTOMER", displayName: "客户" }],
        platforms: ["WEB"],
        statuses: ["ACTIVE", "INACTIVE"],
      },
      { objectList: [response], pageNum: 2, pageSize: 20, totalNum: 1 },
      response,
      { ...response, status: "ACTIVE", version: 4 },
      undefined,
      [
        {
          id: 12,
          name: "客户画像",
          sortOrder: 2,
          url: "https://portal.example.test/customers/42",
        },
      ],
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getEmbeddedPageConfigurationOptions()).resolves.toMatchObject({
      objectTypes: [{ code: "CUSTOMER" }],
    });
    await expect(
      client.getEmbeddedPages({
        objectType: "CUSTOMER",
        page: 2,
        platform: "WEB",
        size: 20,
        status: "INACTIVE",
      }),
    ).resolves.toMatchObject({ objectList: [{ id: 12 }] });
    await client.createEmbeddedPage({
      name: "客户画像",
      objectType: "CUSTOMER",
      platform: "WEB",
      sortOrder: 2,
      urlTemplate: "https://portal.example.test/customers/{recordId}",
    });
    await client.updateEmbeddedPage(12, {
      name: "客户画像",
      sortOrder: 2,
      status: "ACTIVE",
      urlTemplate: "https://portal.example.test/customers/{recordId}",
      version: 3,
    });
    await client.deleteEmbeddedPage(12, 4);
    await expect(client.getRenderedEmbeddedPages("CUSTOMER", 42, "WEB")).resolves.toEqual([
      expect.objectContaining({
        id: 12,
        url: "https://portal.example.test/customers/42",
      }),
    ]);

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toBe("http://localhost/api/v1/embedded-pages/configuration-options");
    const listUrl = new URL(requests[1]?.url ?? "http://localhost");
    expect(listUrl.pathname).toBe("/api/v1/embedded-pages");
    expect(listUrl.searchParams.get("objectType")).toBe("CUSTOMER");
    expect(listUrl.searchParams.get("page")).toBe("2");
    expect(listUrl.searchParams.get("platform")).toBe("WEB");
    expect(listUrl.searchParams.get("size")).toBe("20");
    expect(listUrl.searchParams.get("status")).toBe("INACTIVE");
    expect(requests[2]?.method).toBe("POST");
    await expect(requests[2]?.json()).resolves.toMatchObject({ objectType: "CUSTOMER" });
    expect(requests[3]?.method).toBe("PUT");
    await expect(requests[3]?.json()).resolves.toMatchObject({ status: "ACTIVE", version: 3 });
    expect(requests[4]?.url).toBe("http://localhost/api/v1/embedded-pages/12?version=4");
    expect(requests[5]?.url).toBe(
      "http://localhost/api/v1/embedded-pages/objects/CUSTOMER/42?platform=WEB",
    );
  });

  it("uses the credential-safe lead intake client contracts", async () => {
    const summary = {
      active: true,
      createdTime: "2026-07-30T00:00:00Z",
      id: 12,
      keyId: "key-12",
      ownerActorId: 9,
      updatedTime: "2026-07-30T00:00:00Z",
      version: 3,
    };
    const responses = [
      [summary],
      { apiKey: "tenant.key-12.secret", client: summary },
      {
        ...summary,
        active: false,
        version: 4,
      },
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getLeadIntakeClients()).resolves.toEqual([summary]);
    await expect(client.createLeadIntakeClient()).resolves.toEqual({
      apiKey: "tenant.key-12.secret",
      client: summary,
    });
    await expect(client.deactivateLeadIntakeClient(12, 3)).resolves.toMatchObject({
      active: false,
      id: 12,
      version: 4,
    });

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toBe("http://localhost/api/v1/lead-intake-clients");
    expect(requests[1]?.method).toBe("POST");
    await expect(requests[1]?.json()).resolves.toEqual({});
    expect(requests[2]?.url).toBe("http://localhost/api/v1/lead-intake-clients/12?version=3");
  });

  it("uses named connector summaries and keeps one-time credentials out of read responses", async () => {
    const summary = {
      connectorRef: "connector-reference",
      createdTime: "2026-07-30T00:00:00Z",
      credentials: [
        {
          createdTime: "2026-07-30T00:00:00Z",
          keyId: "connector-key-id",
          revokedTime: null,
          status: "ACTIVE",
        },
      ],
      id: 12,
      retiredTime: null,
      status: "ACTIVE",
      updatedTime: "2026-07-30T00:00:00Z",
      version: 3,
    };
    const responses = [
      { objectList: [summary], pageNum: 2, pageSize: 20, totalNum: 1 },
      summary,
      { connector: summary, credential: "connector-reference.connector-key-id.secret" },
      {
        connector: {
          ...summary,
          credentials: [
            ...summary.credentials,
            { ...summary.credentials[0], keyId: "rotated-key" },
          ],
          version: 4,
        },
        credential: "connector-reference.rotated-key.secret",
      },
      { ...summary, credentials: [{ ...summary.credentials[0], status: "REVOKED" }], version: 5 },
      { ...summary, status: "DISABLED", version: 6 },
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getConnectors({ page: 2, size: 20, status: "ACTIVE" })).resolves.toEqual(
      expect.objectContaining({ objectList: [summary] }),
    );
    await expect(client.getConnector(12)).resolves.toEqual(summary);
    await expect(client.createConnector()).resolves.toMatchObject({ connector: summary });
    await expect(client.rotateConnectorCredential(12, 3)).resolves.toMatchObject({
      connector: expect.objectContaining({ version: 4 }),
    });
    await expect(
      client.revokeConnectorCredential(12, "connector-key-id", 4),
    ).resolves.toMatchObject({
      version: 5,
    });
    await expect(
      client.updateConnectorStatus(12, { status: "DISABLED", version: 5 }),
    ).resolves.toMatchObject({
      status: "DISABLED",
      version: 6,
    });

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toBe("http://localhost/api/v1/connectors/query");
    await expect(requests[0]?.json()).resolves.toEqual({ page: 2, size: 20, status: "ACTIVE" });
    expect(requests[1]?.url).toBe("http://localhost/api/v1/connectors/12");
    expect(requests[2]?.method).toBe("POST");
    await expect(requests[2]?.json()).resolves.toEqual({});
    expect(requests[3]?.url).toBe("http://localhost/api/v1/connectors/12/credentials");
    await expect(requests[3]?.json()).resolves.toEqual({ version: 3 });
    expect(requests[4]?.url).toBe(
      "http://localhost/api/v1/connectors/12/credentials/connector-key-id?version=4",
    );
    expect(requests[5]?.url).toBe("http://localhost/api/v1/connectors/12/status");
    await expect(requests[5]?.json()).resolves.toEqual({ status: "DISABLED", version: 5 });
  });

  it("queries a server-visible activity timeline through the generated request body", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getActivities({
      page: 1,
      size: 20,
      subjectId: 8,
      subjectType: "CUSTOMER",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/activities/query");
    expect(await request.json()).toEqual({
      page: 1,
      size: 20,
      subjectId: 8,
      subjectType: "CUSTOMER",
    });
  });

  it("queries customer-scoped return visits through the generated request body", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getReturnVisits({ customerId: 8, page: 1, size: 20 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/return-visits/query");
    expect(await request.json()).toEqual({ customerId: 8, page: 1, size: 20 });
  });

  it("reads a server-authorized return-visit detail projection", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            customerId: 6,
            id: 8,
            remark: "确认回访安排",
            version: 3,
            visitNumber: "RV-20260725-0008",
            visitTime: "2026-07-25T09:00:00",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getReturnVisit(8)).resolves.toMatchObject({
      customerId: 6,
      id: 8,
      version: 3,
    });
    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/return-visits/8",
    );
  });

  it("creates a return visit through the generated write contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            customerId: 6,
            id: 8,
            remark: "确认回访安排",
            version: 0,
            visitTime: "2026-07-25T09:00:00",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).createReturnVisit({
        customerId: 6,
        remark: "确认回访安排",
        visitTime: "2026-07-25T09:00:00",
      }),
    ).resolves.toMatchObject({ customerId: 6, id: 8, version: 0 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/return-visits");
    expect(await request.json()).toEqual({
      customerId: 6,
      remark: "确认回访安排",
      visitTime: "2026-07-25T09:00:00",
    });
  });

  it("updates only the explicit return-visit basics through the generated versioned contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            customerId: 6,
            id: 8,
            remark: "更新后的回访备注",
            version: 4,
            visitTime: "2026-07-25T10:00:00",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).updateReturnVisit(8, {
        remark: "更新后的回访备注",
        version: 3,
        visitTime: "2026-07-25T10:00:00",
      }),
    ).resolves.toMatchObject({ customerId: 6, id: 8, version: 4 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/return-visits/8");
    expect(await request.json()).toEqual({
      remark: "更新后的回访备注",
      version: 3,
      visitTime: "2026-07-25T10:00:00",
    });
  });

  it("clears one return-visit relation with the generated nullable contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ contactId: null, customerId: 6, id: 8, version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateReturnVisit(8, {
      contactId: null,
      remark: "原始备注",
      version: 3,
      visitTime: "2026-07-25T10:00:00",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/return-visits/8");
    expect(await request.json()).toEqual({
      contactId: null,
      remark: "原始备注",
      version: 3,
      visitTime: "2026-07-25T10:00:00",
    });
  });

  it("updates a return-visit owner with the generated versioned contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, ownerActorId: 9, version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).updateReturnVisitOwner(8, { ownerActorId: 9, version: 3 }),
    ).resolves.toMatchObject({ customerId: 6, id: 8, ownerActorId: 9, version: 4 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/return-visits/8/owner");
    expect(await request.json()).toEqual({ ownerActorId: 9, version: 3 });
  });

  it("soft-deletes a return visit with only its generated path and current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).deleteReturnVisit(8, 3)).resolves.toBeUndefined();

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/return-visits/8?version=3");
  });

  it("reads only server-governed activity methods", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify([
            { displayOrder: 10, label: "电话", type: "METHOD", value: "CALL" },
            { displayOrder: 20, label: "通用模板", type: "TEMPLATE", value: "GENERAL" },
          ]),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getActivityMethods()).resolves.toEqual([
      { label: "电话", value: "CALL" },
    ]);
    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/activities/options",
    );
  });

  it("reads a complete server-authorized follow-up update baseline", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            category: "CALL",
            content: "确认下周演示时间。",
            id: 8,
            kind: "FOLLOW_UP",
            nextContactTime: null,
            occurredTime: "2026-07-25T09:00:00",
            purpose: "需求确认",
            relations: [{ objectType: "CONTACT", recordId: 7 }],
            subjectId: 6,
            subjectType: "CUSTOMER",
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getActivity(8)).resolves.toMatchObject({
      id: 8,
      relations: [{ objectType: "CONTACT", recordId: 7 }],
      version: 3,
    });
    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/activities/8",
    );
  });

  it("creates an activity through the generated write contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).createActivity({
      category: "CALL",
      content: "确认下周演示时间。",
      nextContactTime: "2026-07-30T09:00:00",
      occurredTime: "2026-07-25T09:00:00",
      purpose: "需求确认",
      subjectId: 8,
      subjectType: "CUSTOMER",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/activities");
    expect(await request.json()).toEqual({
      category: "CALL",
      content: "确认下周演示时间。",
      nextContactTime: "2026-07-30T09:00:00",
      occurredTime: "2026-07-25T09:00:00",
      purpose: "需求确认",
      subjectId: 8,
      subjectType: "CUSTOMER",
    });
  });

  it("creates selected same-type activities atomically through the generated batch contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).createActivitiesBatch([
      {
        category: "CALL",
        content: "确认下周演示时间。",
        occurredTime: "2026-08-10T09:00:00",
        purpose: "需求确认",
        subjectId: 8,
        subjectType: "CUSTOMER",
      },
      {
        category: "CALL",
        content: "确认下周演示时间。",
        occurredTime: "2026-08-10T09:00:00",
        purpose: "需求确认",
        subjectId: 12,
        subjectType: "CUSTOMER",
      },
    ]);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/activities/batch");
    expect(await request.json()).toEqual([
      {
        category: "CALL",
        content: "确认下周演示时间。",
        occurredTime: "2026-08-10T09:00:00",
        purpose: "需求确认",
        subjectId: 8,
        subjectType: "CUSTOMER",
      },
      {
        category: "CALL",
        content: "确认下周演示时间。",
        occurredTime: "2026-08-10T09:00:00",
        purpose: "需求确认",
        subjectId: 12,
        subjectType: "CUSTOMER",
      },
    ]);
  });

  it("updates and deletes a follow-up with generated versioned contracts", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async (_input, init) => {
        if (init?.method === "DELETE") return new Response(null, { status: 200 });
        return new Response(
          JSON.stringify({
            category: "CALL",
            content: "已更新的跟进内容。",
            id: 8,
            kind: "FOLLOW_UP",
            nextContactTime: null,
            occurredTime: "2026-07-25T09:00:00",
            purpose: "需求确认",
            relations: [{ objectType: "CONTACT", recordId: 7 }],
            subjectId: 6,
            subjectType: "CUSTOMER",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.stubGlobal("fetch", fetch);
    const apiClient = createApiClient(auth);

    await apiClient.updateActivity(8, {
      category: "CALL",
      content: "已更新的跟进内容。",
      nextContactTime: null,
      occurredTime: "2026-07-25T09:00:00",
      purpose: "需求确认",
      relations: [{ objectType: "CONTACT", recordId: 7 }],
      version: 3,
    });
    await apiClient.deleteActivity(8, 4);

    const updateRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(updateRequest.method).toBe("PUT");
    expect(updateRequest.url).toBe("http://localhost/api/v1/activities/8");
    expect(await updateRequest.json()).toEqual({
      category: "CALL",
      content: "已更新的跟进内容。",
      nextContactTime: null,
      occurredTime: "2026-07-25T09:00:00",
      purpose: "需求确认",
      relations: [{ objectType: "CONTACT", recordId: 7 }],
      version: 3,
    });
    const deleteRequest = new Request(fetch.mock.calls[1]?.[0] as Request);
    expect(deleteRequest.method).toBe("DELETE");
    expect(deleteRequest.url).toBe("http://localhost/api/v1/activities/8?version=4");
  });

  it("reads only the server-authorized contact-pool catalog", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: 8,
              name: "华东联系人公海",
              status: "ACTIVE",
              contactCount: 12,
              administrator: false,
            },
          ]),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getContactPoolCatalog()).resolves.toEqual([
      {
        id: 8,
        name: "华东联系人公海",
        status: "ACTIVE",
        contactCount: 12,
        administrator: false,
      },
    ]);

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/contact-pools/catalog",
    );
  });

  it("queries contacts only inside the requested accessible pool", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getContactPoolContacts(8, { page: 2, size: 50, name: "张" });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/contact-pools/8/contacts?page=2&size=50&name=%E5%BC%A0",
    );
  });

  it("reads the generated customer-pool catalog and configuration page", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const apiClient = createApiClient(auth);

    await apiClient.getCustomerPoolCatalog();
    await apiClient.getCustomerPoolConfigurations({ page: 2, size: 50 });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/customer-pools/catalog",
    );
    expect(new Request(fetch.mock.calls[1]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/customer-pools?page=2&size=50",
    );
  });

  it("queries customers only inside the requested customer pool", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getCustomerPoolCustomers(8, { page: 2, size: 50, name: "张" });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/customer-pools/8/customers?page=2&size=50&name=%E5%BC%A0",
    );
  });

  it("sends customer-pool mutation bodies through their generated contracts", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);
    const apiClient = createApiClient(auth);

    await apiClient.createCustomerPool({
      name: "华东客户公海",
      administratorActorIds: [9],
      eligibleActorIds: [9],
      eligibleDepartmentIds: [],
      dailyClaimLimit: 0,
      previousOwnerCooldownDays: 0,
      automaticReleaseEnabled: false,
      rules: [],
    });
    await apiClient.claimCustomerFromPool(8, {
      customers: [{ customerId: 7, version: 3 }],
    });
    await apiClient.assignCustomerFromPool(8, {
      ownerActorId: 9,
      customers: [{ customerId: 7, version: 3 }],
    });
    await apiClient.deleteCustomerFromPool(8, {
      customers: [{ customerId: 7, version: 3 }],
    });

    const createRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(createRequest.url).toBe("http://localhost/api/v1/customer-pools");
    expect(createRequest.method).toBe("POST");
    expect(await createRequest.json()).toMatchObject({
      name: "华东客户公海",
      administratorActorIds: [9],
    });
    const claimRequest = new Request(fetch.mock.calls[1]?.[0] as Request);
    expect(claimRequest.url).toBe("http://localhost/api/v1/customer-pools/8/customers/claim");
    expect(await claimRequest.json()).toEqual({ customers: [{ customerId: 7, version: 3 }] });
    const assignRequest = new Request(fetch.mock.calls[2]?.[0] as Request);
    expect(assignRequest.url).toBe("http://localhost/api/v1/customer-pools/8/customers/assign");
    expect(await assignRequest.json()).toEqual({
      ownerActorId: 9,
      customers: [{ customerId: 7, version: 3 }],
    });
    const deleteRequest = new Request(fetch.mock.calls[3]?.[0] as Request);
    expect(deleteRequest.method).toBe("DELETE");
    expect(deleteRequest.url).toBe("http://localhost/api/v1/customer-pools/8/customers");
    expect(await deleteRequest.json()).toEqual({ customers: [{ customerId: 7, version: 3 }] });
  });

  it("queries visible leads with a generated body request", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getLeads({
      page: 2,
      size: 50,
      keyword: "张",
      converted: true,
      conditions: [{ fieldCode: "lead_segment", operator: "EQ", values: ["enterprise"] }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/leads/query");
    expect(await request.json()).toEqual({
      page: 2,
      size: 50,
      keyword: "张",
      converted: true,
      conditions: [{ fieldCode: "lead_segment", operator: "EQ", values: ["enterprise"] }],
    });
  });

  it("queries nearby customers through generated coordinate parameters", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getNearbyCustomers({
      longitude: 121.4737,
      latitude: 31.2304,
      radiusMeters: 5000,
      page: 2,
      size: 50,
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/customers/nearby?longitude=121.4737&latitude=31.2304&radiusMeters=5000&page=2&size=50",
    );
  });

  it("queries customers through the body endpoint so temporary conditions stay out of the URL", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const apply = vi.fn(async (request: RequestInit) => request);
    const client = createApiClient({ ...auth, apply });

    await client.getCustomers({
      conditions: [{ fieldCode: "customer_name", operator: "CONTAINS", values: ["Acme"] }],
      page: 1,
      size: 20,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/customers/query");
    expect(await request.json()).toEqual({
      conditions: [{ fieldCode: "customer_name", operator: "CONTAINS", values: ["Acme"] }],
      page: 1,
      size: 20,
    });
    expect(apply.mock.calls[0]?.[0]?.method).toBe("POST");
  });

  it("queries nearby leads through generated coordinate parameters", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getNearbyLeads({
      longitude: 121.4737,
      latitude: 31.2304,
      radiusMeters: 5000,
      page: 2,
      size: 50,
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/leads/nearby?longitude=121.4737&latitude=31.2304&radiusMeters=5000&page=2&size=50",
    );
  });

  it("queries nearby contacts through generated coordinate parameters", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getNearbyContacts({
      longitude: 121.4737,
      latitude: 31.2304,
      radiusMeters: 5000,
      page: 2,
      size: 50,
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/contacts/nearby?longitude=121.4737&latitude=31.2304&radiusMeters=5000&page=2&size=50",
    );
  });

  it("queries visible opportunities through the generated request body", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getOpportunities({
      page: 2,
      size: 50,
      keyword: "续约",
      conditions: [{ fieldCode: "opportunity_segment", operator: "EQ", values: ["enterprise"] }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/opportunities/query");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      page: 2,
      size: 50,
      keyword: "续约",
      conditions: [{ fieldCode: "opportunity_segment", operator: "EQ", values: ["enterprise"] }],
    });
  });

  it("queries visible products through the generated request body", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getProducts({
      page: 2,
      size: 50,
      keyword: "套餐",
      conditions: [{ fieldCode: "availability", operator: "EQ", values: ["AVAILABLE"] }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/products/query");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      page: 2,
      size: 50,
      keyword: "套餐",
      conditions: [{ fieldCode: "availability", operator: "EQ", values: ["AVAILABLE"] }],
    });
  });

  it("exports a bounded product CSV through the controlled Blob channel", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(new Blob(["product_id,product_name\\n8,入门套餐\\n"], { type: "text/csv" }), {
          headers: {
            "Content-Disposition": 'attachment; filename="products.csv"',
            "Content-Type": "text/csv;charset=UTF-8",
          },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const download = await createApiClient(auth).exportProductsCsv({
      availability: "AVAILABLE",
      conditions: [{ fieldCode: "product_name", operator: "CONTAINS", values: ["套餐"] }],
      fieldCodes: ["product_name", "product_code"],
      keyword: "套餐",
      sortDirection: "DESC",
      sortField: "UPDATED_TIME",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/products/export/csv");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      availability: "AVAILABLE",
      conditions: [{ fieldCode: "product_name", operator: "CONTAINS", values: ["套餐"] }],
      fieldCodes: ["product_name", "product_code"],
      keyword: "套餐",
      sortDirection: "DESC",
      sortField: "UPDATED_TIME",
    });
    expect(download).toMatchObject({
      contentType: "text/csv;charset=UTF-8",
      fileName: "products.csv",
    });
  });

  it("decodes a visible product through the typed detail boundary", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            code: "PLAN-A",
            id: 8,
            listPrice: 99.99,
            name: "入门套餐",
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const product = await createApiClient(auth).getProduct(8);

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/products/8",
    );
    expect(product).toMatchObject({ code: "PLAN-A", id: 8, listPrice: 99.99, name: "入门套餐" });
  });

  it("creates a product through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({ code: "PLAN-A", id: 8, listPrice: 99.99, name: "入门套餐", version: 0 }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).createProduct({
      code: "PLAN-A",
      listPrice: 99.99,
      name: "入门套餐",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/products");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({ code: "PLAN-A", listPrice: 99.99, name: "入门套餐" });
  });

  it("reads the safe product replacement baseline before updating a product", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            categoryId: 9,
            code: "PLAN-A",
            description: "适合入门团队",
            editable: true,
            id: 8,
            listPrice: 99.99,
            name: "入门套餐",
            unit: "套",
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const client = createApiClient(auth);
    const baseline = await client.getProductEditableBaseline(8);
    await client.updateProduct(8, {
      categoryId: 9,
      code: "PLAN-B",
      description: "适合成长团队",
      listPrice: 199.99,
      name: "成长套餐",
      unit: "套",
      version: 3,
    });

    expect(baseline).toMatchObject({ editable: true, id: 8, version: 3 });
    const baselineRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(baselineRequest.method).toBe("GET");
    expect(baselineRequest.url).toBe("http://localhost/api/v1/products/8/editable-baseline");
    const updateRequest = new Request(fetch.mock.calls[1]?.[0] as Request);
    expect(updateRequest.method).toBe("PUT");
    expect(updateRequest.url).toBe("http://localhost/api/v1/products/8");
    expect(await updateRequest.json()).toEqual({
      categoryId: 9,
      code: "PLAN-B",
      description: "适合成长团队",
      listPrice: 199.99,
      name: "成长套餐",
      unit: "套",
      version: 3,
    });
  });

  it("reads the safe opportunity replacement baseline before updating an opportunity", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            customerId: 7,
            description: "续约讨论",
            editable: true,
            estimatedAmount: 1250.5,
            expectedCloseDate: "2026-09-30",
            id: 8,
            name: "年度续约",
            nextContactTime: null,
            pipelineCode: "direct",
            stageCode: "qualification",
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const client = createApiClient(auth);
    const baseline = await client.getOpportunityEditableBaseline(8);
    await client.updateOpportunity(8, {
      customerId: 7,
      description: "续约确认",
      estimatedAmount: 1250.5,
      expectedCloseDate: "2026-09-30",
      name: "年度续约（已确认）",
      nextContactTime: null,
      pipelineCode: "direct",
      stageCode: "qualification",
      version: 3,
    });

    expect(baseline).toMatchObject({ editable: true, id: 8, version: 3 });
    const baselineRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(baselineRequest.method).toBe("GET");
    expect(baselineRequest.url).toBe("http://localhost/api/v1/opportunities/8/editable-baseline");
    const updateRequest = new Request(fetch.mock.calls[1]?.[0] as Request);
    expect(updateRequest.method).toBe("PUT");
    expect(updateRequest.url).toBe("http://localhost/api/v1/opportunities/8");
    expect(await updateRequest.json()).toEqual({
      customerId: 7,
      description: "续约确认",
      estimatedAmount: 1250.5,
      expectedCloseDate: "2026-09-30",
      name: "年度续约（已确认）",
      nextContactTime: null,
      pipelineCode: "direct",
      stageCode: "qualification",
      version: 3,
    });
  });

  it("reads the authoritative opportunity collaborator baseline before replacing it", async () => {
    const responses = [
      { callerState: "OWNER", collaborators: [{ access: "READ", actorId: 9 }], version: 3 },
      { id: 8, name: "年度续约", version: 4 },
      null,
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const client = createApiClient(auth);
    await expect(client.getOpportunityCollaboratorBaseline(8)).resolves.toEqual({
      callerState: "OWNER",
      collaborators: [{ access: "READ", actorId: 9 }],
      version: 3,
    });
    await expect(
      client.replaceOpportunityCollaborators(8, {
        collaborators: [{ access: "WRITE", actorId: 9 }],
        version: 3,
      }),
    ).resolves.toMatchObject({ id: 8, version: 4 });
    await expect(client.exitOpportunityCollaborator(8, 4)).resolves.toBeUndefined();

    const baselineRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(baselineRequest.method).toBe("GET");
    expect(baselineRequest.url).toBe("http://localhost/api/v1/opportunities/8/collaborators");
    const replaceRequest = new Request(fetch.mock.calls[1]?.[0] as Request);
    expect(replaceRequest.method).toBe("PUT");
    expect(replaceRequest.url).toBe("http://localhost/api/v1/opportunities/8/collaborators");
    await expect(replaceRequest.json()).resolves.toEqual({
      collaborators: [{ access: "WRITE", actorId: 9 }],
      version: 3,
    });
    const exitRequest = new Request(fetch.mock.calls[2]?.[0] as Request);
    expect(exitRequest.method).toBe("DELETE");
    expect(exitRequest.url).toBe(
      "http://localhost/api/v1/opportunities/8/collaborators/me?version=4",
    );
  });

  it("uses a complete opportunity contacts baseline before replacing contacts", async () => {
    const responses = [
      {
        contacts: [{ id: 9, name: "张三", primary: true }],
        customerId: 7,
        editable: true,
        id: 8,
        version: 3,
      },
      { id: 8, name: "年度续约", version: 4 },
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const client = createApiClient(auth);
    await expect(client.getOpportunityContactsBaseline(8)).resolves.toEqual({
      contacts: [{ id: 9, name: "张三", primary: true }],
      customerId: 7,
      editable: true,
      id: 8,
      version: 3,
    });
    await expect(
      client.replaceOpportunityContacts(8, {
        contactIds: [9],
        primaryContactId: 9,
        version: 3,
      }),
    ).resolves.toMatchObject({ id: 8, version: 4 });

    const baselineRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(baselineRequest.method).toBe("GET");
    expect(baselineRequest.url).toBe("http://localhost/api/v1/opportunities/8/contacts/baseline");
    const replaceRequest = new Request(fetch.mock.calls[1]?.[0] as Request);
    expect(replaceRequest.method).toBe("PUT");
    expect(replaceRequest.url).toBe("http://localhost/api/v1/opportunities/8/contacts");
    await expect(replaceRequest.json()).resolves.toEqual({
      contactIds: [9],
      primaryContactId: 9,
      version: 3,
    });
  });

  it("uses the complete typed opportunity product snapshot before replacing products", async () => {
    const responses = [
      {
        lines: [
          {
            categoryName: "订阅",
            productCode: "PLAN-A",
            productId: 9,
            productName: "入门套餐",
            quantity: 2,
            unit: "套",
            unitPrice: 99.9,
          },
        ],
        opportunityId: 8,
        version: 3,
      },
      {
        lines: [
          {
            categoryName: "订阅",
            productCode: "PLAN-A",
            productId: 9,
            productName: "入门套餐",
            quantity: 3,
            unit: "套",
            unitPrice: 99.9,
          },
        ],
        opportunityId: 8,
        version: 4,
      },
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const client = createApiClient(auth);
    await expect(client.getOpportunityProductBaseline(8)).resolves.toMatchObject({
      opportunityId: 8,
      version: 3,
    });
    await expect(
      client.replaceOpportunityProducts(8, {
        lines: [{ productId: 9, quantity: 3, unitPrice: 99.9 }],
        version: 3,
      }),
    ).resolves.toMatchObject({ opportunityId: 8, version: 4 });

    const baselineRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(baselineRequest.method).toBe("GET");
    expect(baselineRequest.url).toBe("http://localhost/api/v1/opportunities/8/products");
    const replaceRequest = new Request(fetch.mock.calls[1]?.[0] as Request);
    expect(replaceRequest.method).toBe("PUT");
    expect(replaceRequest.url).toBe("http://localhost/api/v1/opportunities/8/products");
    await expect(replaceRequest.json()).resolves.toEqual({
      lines: [{ productId: 9, quantity: 3, unitPrice: 99.9 }],
      version: 3,
    });
  });

  it("updates product availability with the current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            availability: "UNAVAILABLE",
            code: "PLAN-A",
            id: 8,
            listPrice: 99.99,
            name: "入门套餐",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateProductAvailability(8, {
      availability: "UNAVAILABLE",
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/products/8/availability");
    expect(await request.json()).toEqual({ availability: "UNAVAILABLE", version: 3 });
  });

  it("updates product owner with the current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            code: "PLAN-A",
            id: 8,
            listPrice: 99.99,
            name: "入门套餐",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateProductOwner(8, { ownerActorId: 9, version: 3 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/products/8/owner");
    expect(await request.json()).toEqual({ ownerActorId: 9, version: 3 });
  });

  it("reads the opaque product category tree through a narrow projection", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify([{ children: [], id: 9, name: "解决方案", status: "ACTIVE", version: 0 }]),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getProductCategories()).resolves.toEqual([
      {
        children: [],
        id: 9,
        name: "解决方案",
        parentCategoryId: null,
        status: "ACTIVE",
        version: 0,
      },
    ]);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("GET");
    expect(request.url).toBe("http://localhost/api/v1/product-categories");
  });

  it("creates a root product category through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({ children: [], id: 9, name: "解决方案", status: "ACTIVE", version: 0 }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).createProductCategory({ name: "解决方案" });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/product-categories");
    expect(await request.json()).toEqual({ name: "解决方案" });
  });

  it("creates a child product category through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            children: [],
            id: 10,
            name: "订阅服务",
            parentCategoryId: 9,
            status: "ACTIVE",
            version: 0,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).createProductCategory({ name: "订阅服务", parentCategoryId: 9 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/product-categories");
    expect(await request.json()).toEqual({ name: "订阅服务", parentCategoryId: 9 });
  });

  it("updates a product category name with its current tree version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            children: [],
            id: 9,
            name: "续费服务",
            parentCategoryId: 4,
            status: "ACTIVE",
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateProductCategory(9, {
      name: "续费服务",
      parentCategoryId: 4,
      version: 2,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/product-categories/9");
    expect(await request.json()).toEqual({
      name: "续费服务",
      parentCategoryId: 4,
      version: 2,
    });
  });

  it("deletes a product with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteProduct(7, 4);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/products/7?version=4");
  });

  it("deletes a product category with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteProductCategory(9, 2);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/product-categories/9?version=2");
  });

  it("decodes a visible opportunity through the typed detail boundary", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            id: 8,
            name: "年度续约",
            pipelineCode: "direct",
            stageCode: "discovery",
            version: 0,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const opportunity = await createApiClient(auth).getOpportunity(8);

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/opportunities/8",
    );
    expect(opportunity).toMatchObject({
      id: 8,
      name: "年度续约",
      pipelineCode: "direct",
      stageCode: "discovery",
    });
  });

  it("decodes a money-free opportunity product snapshot", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            lines: [{ productId: 7, productName: "入门套餐", quantity: 2 }],
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const products = await createApiClient(auth).getOpportunityProducts(8);

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/opportunities/8/products",
    );
    expect(products).toEqual({
      lines: [
        {
          categoryName: null,
          productCode: null,
          productId: 7,
          productName: "入门套餐",
          quantity: "2",
          unit: null,
        },
      ],
      version: 3,
    });
  });

  it("reads the server-visible contacts related to an opportunity", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [{ id: 7, name: "张三", primary: true }] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getOpportunityContacts(8)).resolves.toEqual([
      { id: 7, name: "张三", primary: true },
    ]);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe(
      "http://localhost/api/v1/opportunities/8/contacts/query?page=1&size=100",
    );
    expect(request.method).toBe("POST");
  });

  it("creates an opportunity through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "年度续约", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).createOpportunity({
      customerId: 7,
      name: "年度续约",
      pipelineCode: "direct",
      stageCode: "discovery",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/opportunities");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      customerId: 7,
      name: "年度续约",
      pipelineCode: "direct",
      stageCode: "discovery",
    });
  });

  it("sets the caller's personal opportunity star without a record version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).setOpportunityStarred(8, { starred: true });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/opportunities/8/star");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ starred: true });
  });

  it("updates an opportunity stage with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            id: 8,
            name: "年度续约",
            pipelineCode: "direct",
            stageCode: "negotiation",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const opportunity = await createApiClient(auth).updateOpportunityStage(8, {
      pipelineCode: "direct",
      stageCode: "negotiation",
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/opportunities/8/stage");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({
      pipelineCode: "direct",
      stageCode: "negotiation",
      version: 3,
    });
    expect(opportunity).toMatchObject({ id: 8, stageCode: "negotiation", version: 4 });
  });

  it("updates an opportunity outcome with its original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "年度续约", outcome: "WON", version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const opportunity = await createApiClient(auth).updateOpportunityOutcome(8, {
      outcome: "WON",
      remark: "已签约",
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/opportunities/8/outcome");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ outcome: "WON", remark: "已签约", version: 3 });
    expect(opportunity).toMatchObject({ id: 8, outcome: "WON", version: 4 });
  });

  it("updates an opportunity owner with its original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "年度续约", ownerActorId: 9, version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const opportunity = await createApiClient(auth).updateOpportunityOwner(8, {
      ownerActorId: 9,
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/opportunities/8/owner");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ ownerActorId: 9, version: 3 });
    expect(opportunity).toMatchObject({ id: 8, ownerActorId: 9, version: 4 });
  });

  it("sets or clears an opportunity primary contact with its original version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "年度续约", version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const opportunity = await createApiClient(auth).updateOpportunityPrimaryContact(8, {
      contactId: 7,
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/opportunities/8/primary-contact");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ contactId: 7, version: 3 });
    expect(opportunity).toMatchObject({ id: 8, version: 4 });
  });

  it("manages opportunity pipelines and stages with server version baselines", async () => {
    const pipeline = {
      code: "direct",
      displayOrder: 10,
      id: 3,
      name: "直销",
      status: "INACTIVE",
      version: 4,
    };
    const stage = {
      code: "qualification",
      displayOrder: 10,
      id: 8,
      name: "需求确认",
      pipelineCode: "direct",
      probability: 20,
      status: "INACTIVE",
      version: 5,
    };
    const responses = [
      { objectList: [pipeline], pageNum: 1, pageSize: 100, totalNum: 1 },
      pipeline,
      { ...pipeline, name: "直销团队", version: 5 },
      { ...pipeline, status: "ACTIVE", version: 6 },
      {},
      { objectList: [stage], pageNum: 1, pageSize: 100, totalNum: 1 },
      stage,
      { ...stage, name: "资格确认", version: 6 },
      { ...stage, status: "ACTIVE", version: 7 },
      {},
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const client = createApiClient(auth);
    await expect(
      client.queryOpportunityPipelineCatalog({ page: 1, size: 100 }),
    ).resolves.toMatchObject({
      totalNum: 1,
    });
    await expect(
      client.createOpportunityPipeline({ code: "direct", displayOrder: 10, name: "直销" }),
    ).resolves.toMatchObject(pipeline);
    await expect(
      client.updateOpportunityPipeline(3, { displayOrder: 11, name: "直销团队", version: 4 }),
    ).resolves.toMatchObject({ name: "直销团队", version: 5 });
    await expect(
      client.updateOpportunityPipelineStatus(3, { status: "ACTIVE", version: 5 }),
    ).resolves.toMatchObject({ status: "ACTIVE", version: 6 });
    await expect(client.deleteOpportunityPipeline(3, 6)).resolves.toBeUndefined();
    await expect(
      client.queryOpportunityPipelineStagesCatalog(3, { page: 1, size: 100 }),
    ).resolves.toMatchObject({ totalNum: 1 });
    await expect(
      client.createOpportunityPipelineStage(3, {
        code: "qualification",
        displayOrder: 10,
        name: "需求确认",
        probability: 20,
      }),
    ).resolves.toMatchObject(stage);
    await expect(
      client.updateOpportunityPipelineStage(3, 8, {
        displayOrder: 11,
        name: "资格确认",
        probability: 25,
        version: 5,
      }),
    ).resolves.toMatchObject({ name: "资格确认", version: 6 });
    await expect(
      client.updateOpportunityPipelineStageStatus(3, 8, { status: "ACTIVE", version: 6 }),
    ).resolves.toMatchObject({ status: "ACTIVE", version: 7 });
    await expect(client.deleteOpportunityPipelineStage(3, 8, 7)).resolves.toBeUndefined();

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toEqual(
      [
        "POST /api/v1/opportunity-pipelines/query",
        "POST /api/v1/opportunity-pipelines",
        "PUT /api/v1/opportunity-pipelines/3",
        "PUT /api/v1/opportunity-pipelines/3/status",
        "DELETE /api/v1/opportunity-pipelines/3",
        "POST /api/v1/opportunity-pipelines/3/stages/query",
        "POST /api/v1/opportunity-pipelines/3/stages",
        "PUT /api/v1/opportunity-pipelines/3/stages/8",
        "PUT /api/v1/opportunity-pipelines/3/stages/8/status",
        "DELETE /api/v1/opportunity-pipelines/3/stages/8",
      ],
    );
    await expect(requests[2]?.json()).resolves.toEqual({
      displayOrder: 11,
      name: "直销团队",
      version: 4,
    });
    expect(new URL(requests[4]!.url).searchParams.get("version")).toBe("6");
    await expect(requests[7]?.json()).resolves.toEqual({
      displayOrder: 11,
      name: "资格确认",
      probability: 25,
      version: 5,
    });
    expect(new URL(requests[9]!.url).searchParams.get("version")).toBe("7");
  });

  it("deletes an opportunity with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteOpportunity(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/opportunities/8?version=3");
  });

  it("decodes a visible lead through the typed detail boundary", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 0, jobTitle: "采购经理" }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const lead = await createApiClient(auth).getLead(8);

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/leads/8",
    );
    expect(lead).toMatchObject({ id: 8, name: "张三", jobTitle: "采购经理" });
  });

  it("exports a bounded lead CSV through the controlled Blob channel", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(new Blob(["lead_id,lead_name\\n8,张三\\n"], { type: "text/csv" }), {
          headers: {
            "Content-Disposition": 'attachment; filename="leads.csv"',
            "Content-Type": "text/csv;charset=UTF-8",
          },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const download = await createApiClient(auth).exportLeadsCsv({
      conditions: [{ fieldCode: "lead_segment", operator: "EQ", values: ["enterprise"] }],
      converted: false,
      fieldCodes: ["lead_name"],
      keyword: "张三",
      subordinateOwnerOnly: true,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads/export/csv");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      conditions: [{ fieldCode: "lead_segment", operator: "EQ", values: ["enterprise"] }],
      converted: false,
      fieldCodes: ["lead_name"],
      keyword: "张三",
      subordinateOwnerOnly: true,
    });
    expect(download).toMatchObject({
      contentType: "text/csv;charset=UTF-8",
      fileName: "leads.csv",
    });
  });

  it("creates a lead through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 0, jobTitle: "采购经理" }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const lead = await createApiClient(auth).createLead({
      name: "张三",
      jobTitle: "采购经理",
      phoneNumber: "+8613812345678",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      name: "张三",
      jobTitle: "采购经理",
      phoneNumber: "+8613812345678",
    });
    expect(lead).toMatchObject({ id: 8, name: "张三", jobTitle: "采购经理" });
  });

  it("converts a lead through the generated versioned request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ leadId: 8, customerId: 9, contactId: 10, leadVersion: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).convertLead(8, {
        version: 3,
        customerName: "转换客户",
        contactName: "联系人",
        contactJobTitle: "采购经理",
      }),
    ).resolves.toEqual({ leadId: 8, customerId: 9, contactId: 10, leadVersion: 4 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads/8/convert");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      version: 3,
      customerName: "转换客户",
      contactName: "联系人",
      contactJobTitle: "采购经理",
    });
  });

  it("checks lead duplicates without exposing matched records", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ duplicate: true }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).checkLeadDuplicate({
        name: "张三",
        phoneNumber: "+8613812345678",
      }),
    ).resolves.toBe(true);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads/duplicate-check");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({ name: "张三", phoneNumber: "+8613812345678" });
  });

  it("sets the caller's personal lead star without a record version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).setLeadStarred(8, { starred: true });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads/8/star");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ starred: true });
  });

  it("updates the complete lead lock and deal state with the original version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({ id: 8, name: "张三", version: 4, locked: true, dealStatus: "WON" }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const lead = await createApiClient(auth).updateLeadState(8, {
      version: 3,
      locked: true,
      dealStatus: "WON",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads/8/state");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ version: 3, locked: true, dealStatus: "WON" });
    expect(lead).toMatchObject({ id: 8, version: 4, locked: true, dealStatus: "WON" });
  });

  it("replaces lead tags with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", tags: ["重点线索"], version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const lead = await createApiClient(auth).replaceLeadTags(8, {
      tags: ["重点线索"],
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/leads/8/tags");
    expect(await request.json()).toEqual({ tags: ["重点线索"], version: 3 });
    expect(lead).toMatchObject({ id: 8, tags: ["重点线索"], version: 4 });
  });

  it("changes tags for a versioned lead batch through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).changeLeadTags({
      leads: [{ leadId: 8, version: 3 }],
      addedTags: ["重点线索"],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads/batch/tags");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      leads: [{ leadId: 8, version: 3 }],
      addedTags: ["重点线索"],
    });
  });

  it("transfers versioned leads through the generated batch-owner contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateLeadOwners({
      ownerActorId: 9,
      leads: [{ leadId: 8, version: 3 }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads/batch/owner");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({
      ownerActorId: 9,
      leads: [{ leadId: 8, version: 3 }],
    });
  });

  it("deletes versioned leads through the generated batch-delete contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteLeads({ leads: [{ leadId: 8, version: 3 }] });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads/batch/delete");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({ leads: [{ leadId: 8, version: 3 }] });
  });

  it("reads the complete lead collaborator replacement baseline", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            version: 3,
            callerState: "OWNER",
            collaborators: [{ actorId: 9, access: "READ" }],
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getLeadCollaboratorBaseline(8)).resolves.toEqual({
      version: 3,
      callerState: "OWNER",
      collaborators: [{ actorId: 9, access: "READ" }],
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/leads/8/collaborators",
    );
  });

  it("reads the server-visible lead hierarchy", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            requestedLeadId: 8,
            leads: [
              { id: 7, name: "上级线索", parentLeadId: null },
              { id: 8, name: "张三", parentLeadId: 7 },
            ],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getLeadHierarchy(8)).resolves.toMatchObject({
      requestedLeadId: 8,
      leads: [
        { id: 7, name: "上级线索" },
        { id: 8, parentLeadId: 7 },
      ],
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/leads/8/hierarchy",
    );
  });

  it("updates a lead and explicitly clears supported nullable fields with its original version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 4, jobTitle: "销售总监" }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const lead = await createApiClient(auth).updateLead(8, {
      version: 3,
      jobTitle: "销售总监",
      nextContactTime: null,
      customerId: null,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads/8");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({
      version: 3,
      jobTitle: "销售总监",
      nextContactTime: null,
      customerId: null,
    });
    expect(lead).toMatchObject({ id: 8, name: "张三", jobTitle: "销售总监", version: 4 });
  });

  it("updates a lead owner with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 4, ownerActorId: 9 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const lead = await createApiClient(auth).updateLeadOwner(8, {
      version: 3,
      ownerActorId: 9,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads/8/owner");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ version: 3, ownerActorId: 9 });
    expect(lead.ownerActorId).toBe(9);
  });

  it("sets or clears the lead parent with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 4, parentLeadId: 9 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateLeadParent(8, { version: 3, parentLeadId: 9 });
    await createApiClient(auth).updateLeadParent(8, { version: 4 });

    const setRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(setRequest.url).toBe("http://localhost/api/v1/leads/8/parent");
    expect(setRequest.method).toBe("PUT");
    expect(await setRequest.json()).toEqual({ version: 3, parentLeadId: 9 });
    expect(await new Request(fetch.mock.calls[1]?.[0] as Request).json()).toEqual({ version: 4 });
  });

  it("replaces lead collaborators with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).replaceLeadCollaborators(8, {
      version: 3,
      collaborators: [{ actorId: 9, access: "WRITE" }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads/8/collaborators");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({
      version: 3,
      collaborators: [{ actorId: 9, access: "WRITE" }],
    });
  });

  it("exits lead collaboration with the current optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).exitLeadCollaborator(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/leads/8/collaborators/me?version=3");
    expect(request.method).toBe("DELETE");
  });

  it("deletes a lead with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteLead(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/leads/8?version=3");
  });

  it("queries paged contact-pool configurations through the management endpoint", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getContactPoolConfigurations({ page: 2, size: 50 });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/contact-pools?page=2&size=50",
    );
  });

  it("creates a contact pool through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).createContactPool({
      name: "华东联系人公海",
      administratorActorIds: [9],
      eligibleActorIds: [9],
      eligibleDepartmentIds: [],
      dailyClaimLimit: 0,
      previousOwnerCooldownDays: 0,
      automaticReleaseEnabled: false,
      rules: [],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contact-pools");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      name: "华东联系人公海",
      administratorActorIds: [9],
      eligibleActorIds: [9],
      eligibleDepartmentIds: [],
      dailyClaimLimit: 0,
      previousOwnerCooldownDays: 0,
      automaticReleaseEnabled: false,
      rules: [],
    });
  });

  it("updates a contact-pool status with the management version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateContactPoolStatus(8, { active: false, version: 3 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contact-pools/8/status");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ active: false, version: 3 });
  });

  it("updates a full contact-pool configuration through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateContactPool(8, {
      version: 3,
      name: "华东联系人公海",
      administratorActorIds: [9],
      eligibleActorIds: [9],
      eligibleDepartmentIds: [],
      dailyClaimLimit: 20,
      previousOwnerCooldownDays: 7,
      automaticReleaseEnabled: true,
      rules: [{ type: "STALE_UPDATE", inactiveDays: 30 }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contact-pools/8");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({
      version: 3,
      name: "华东联系人公海",
      administratorActorIds: [9],
      eligibleActorIds: [9],
      eligibleDepartmentIds: [],
      dailyClaimLimit: 20,
      previousOwnerCooldownDays: 7,
      automaticReleaseEnabled: true,
      rules: [{ type: "STALE_UPDATE", inactiveDays: 30 }],
    });
  });

  it("transfers a contact pool through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).transferContactPool(8, { targetPoolId: 9 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contact-pools/8/transfer");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({ targetPoolId: 9 });
  });

  it("soft-deletes an empty contact pool with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteContactPool(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contact-pools/8?version=3");
    expect(request.method).toBe("DELETE");
  });

  it("lists server-visible active departments for contact-pool qualification", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify([{ id: 9, name: "华东销售", active: true }]), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getVisibleDepartments()).resolves.toEqual([
      { departmentId: 9, name: "华东销售" },
    ]);
    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/organization/departments",
    );
  });

  it("lists and validates the verified caller's accessible tenants", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async (input) => {
        const request = new Request(input);
        const payload = request.url.endsWith("/access")
          ? { tenantId: 9, departmentId: 4, granted: true }
          : [{ tenantId: 9, departmentId: 4, granted: true }];
        return new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getAccessibleTenants()).resolves.toEqual([
      { tenantId: 9, departmentId: 4, granted: true },
    ]);
    await expect(createApiClient(auth).validateTenantAccess(9)).resolves.toEqual({
      tenantId: 9,
      departmentId: 4,
      granted: true,
    });
    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/organization/tenants",
    );
    expect(new Request(fetch.mock.calls[1]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/organization/tenants/9/access",
    );
  });

  it("releases a versioned visible contact into the requested pool", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).releaseContactToPool(8, {
      contacts: [{ contactId: 7, version: 3 }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contact-pools/8/contacts/release");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({ contacts: [{ contactId: 7, version: 3 }] });
  });

  it("claims a versioned contact from the requested pool", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).claimContactFromPool(8, {
      contacts: [{ contactId: 7, version: 3 }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contact-pools/8/contacts/claim");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({ contacts: [{ contactId: 7, version: 3 }] });
  });

  it("assigns a versioned pool contact to the selected member", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).assignContactFromPool(8, {
      ownerActorId: 9,
      contacts: [{ contactId: 7, version: 3 }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contact-pools/8/contacts/assign");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      ownerActorId: 9,
      contacts: [{ contactId: 7, version: 3 }],
    });
  });

  it("soft-deletes a versioned contact from the requested pool", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteContactFromPool(8, {
      contacts: [{ contactId: 7, version: 3 }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contact-pools/8/contacts");
    expect(request.method).toBe("DELETE");
    expect(await request.json()).toEqual({ contacts: [{ contactId: 7, version: 3 }] });
  });

  it("queries visible contacts with a generated body request", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getContacts({
      page: 2,
      size: 50,
      keyword: "张",
      conditions: [{ fieldCode: "contact_segment", operator: "EQ", values: ["enterprise"] }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/contacts/query");
    expect(await request.json()).toEqual({
      page: 2,
      size: 50,
      keyword: "张",
      conditions: [{ fieldCode: "contact_segment", operator: "EQ", values: ["enterprise"] }],
    });
  });

  it("queries customer-scoped contracts through the generated page request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getContracts({ customerId: 6, keyword: "续约", page: 1, size: 50 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/contracts/query");
    expect(await request.json()).toEqual({ customerId: 6, keyword: "续约", page: 1, size: 50 });
  });

  it("loads only safe contract options for a global relation filter", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            objectList: [{ customerId: 6, id: 8, name: "续约合同", version: 0 }],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).getVisibleContracts({ keyword: "续约", page: 1, size: 50 }),
    ).resolves.toEqual([{ id: 8, name: "续约合同" }]);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/contracts/query");
    expect(await request.json()).toEqual({ keyword: "续约", page: 1, size: 50 });
  });

  it("confirms one contract relation through the typed detail boundary", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, number: "HT-008", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getVisibleContract(8)).resolves.toEqual({
      id: 8,
      name: "HT-008",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("GET");
    expect(request.url).toBe("http://localhost/api/v1/contracts/8");
  });

  it("loads only safe opportunity options for a global relation filter", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [{ id: 8, name: "续约商机" }] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).getVisibleOpportunities({ keyword: "续约", page: 1, size: 50 }),
    ).resolves.toEqual([{ id: 8, name: "续约商机" }]);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/opportunities/query");
    expect(await request.json()).toEqual({ keyword: "续约", page: 1, size: 50 });
  });

  it("confirms one opportunity relation through the typed detail boundary", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "续约商机", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getVisibleOpportunity(8)).resolves.toEqual({
      id: 8,
      name: "续约商机",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("GET");
    expect(request.url).toBe("http://localhost/api/v1/opportunities/8");
  });

  it("loads only money-free receivable-plan options for a global relation filter", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({ objectList: [{ customerId: 6, id: 8, installment: 2, version: 0 }] }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).getVisibleReceivablePlans({ keyword: "第二期", page: 1, size: 50 }),
    ).resolves.toEqual([{ id: 8, name: "第 2 期" }]);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/receivable-plans/query");
    expect(await request.json()).toEqual({ keyword: "第二期", page: 1, size: 50 });
  });

  it("confirms one receivable-plan relation through the typed detail boundary", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, installment: 2, version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getVisibleReceivablePlan(8)).resolves.toEqual({
      id: 8,
      name: "第 2 期",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("GET");
    expect(request.url).toBe("http://localhost/api/v1/receivable-plans/8");
  });

  it("queries each cross-customer finance list and plan workspace through server-scoped endpoints", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const apiClient = createApiClient(auth);

    await apiClient.getContracts({
      keyword: "续约",
      page: 1,
      size: 20,
      subordinateOwnerOnly: true,
    });
    await apiClient.getReceivables({
      keyword: "到账",
      page: 1,
      size: 20,
      subordinateOwnerOnly: true,
    });
    await apiClient.getReceivablePlans({
      keyword: "2",
      page: 1,
      size: 20,
      subordinateOwnerOnly: true,
    });
    await apiClient.getInvoices({
      keyword: "开票",
      page: 1,
      size: 20,
      subordinateOwnerOnly: true,
    });
    await apiClient.getReturnVisits({
      keyword: "回访",
      page: 1,
      size: 20,
      subordinateOwnerOnly: true,
    });

    const requests = await Promise.all(
      fetch.mock.calls.map(async ([input]) => {
        const request = new Request(input as Request);
        return { path: new URL(request.url).pathname, body: await request.json() };
      }),
    );
    expect(requests).toEqual([
      {
        path: "/api/v1/contracts/query",
        body: { keyword: "续约", page: 1, size: 20, subordinateOwnerOnly: true },
      },
      {
        path: "/api/v1/receivables/query",
        body: { keyword: "到账", page: 1, size: 20, subordinateOwnerOnly: true },
      },
      {
        path: "/api/v1/receivable-plans/query",
        body: { keyword: "2", page: 1, size: 20, subordinateOwnerOnly: true },
      },
      {
        path: "/api/v1/invoices/query",
        body: { keyword: "开票", page: 1, size: 20, subordinateOwnerOnly: true },
      },
      {
        path: "/api/v1/return-visits/query",
        body: { keyword: "回访", page: 1, size: 20, subordinateOwnerOnly: true },
      },
    ]);
  });

  it("sends temporary advanced filters for every cross-customer finance list in the request body", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const apiClient = createApiClient(auth);

    await apiClient.getContracts({
      conditions: [{ fieldCode: "contract_name", operator: "CONTAINS", values: ["续约"] }],
      page: 1,
      size: 20,
    });
    await apiClient.getReceivables({
      conditions: [{ fieldCode: "receipt_number", operator: "CONTAINS", values: ["到账"] }],
      page: 1,
      size: 20,
    });
    await apiClient.getReceivablePlans({
      conditions: [{ fieldCode: "payment_method", operator: "EQ", values: ["BANK_TRANSFER"] }],
      page: 1,
      size: 20,
    });
    await apiClient.getInvoices({
      conditions: [{ fieldCode: "application_number", operator: "CONTAINS", values: ["开票"] }],
      page: 1,
      size: 20,
    });
    await apiClient.getReturnVisits({
      conditions: [{ fieldCode: "visit_number", operator: "CONTAINS", values: ["回访"] }],
      page: 1,
      size: 20,
    });

    const requests = await Promise.all(
      fetch.mock.calls.map(async ([input]) => {
        const request = new Request(input as Request);
        return { path: new URL(request.url).pathname, body: await request.json() };
      }),
    );
    expect(requests).toEqual([
      {
        path: "/api/v1/contracts/query",
        body: {
          conditions: [{ fieldCode: "contract_name", operator: "CONTAINS", values: ["续约"] }],
          page: 1,
          size: 20,
        },
      },
      {
        path: "/api/v1/receivables/query",
        body: {
          conditions: [{ fieldCode: "receipt_number", operator: "CONTAINS", values: ["到账"] }],
          page: 1,
          size: 20,
        },
      },
      {
        path: "/api/v1/receivable-plans/query",
        body: {
          conditions: [{ fieldCode: "payment_method", operator: "EQ", values: ["BANK_TRANSFER"] }],
          page: 1,
          size: 20,
        },
      },
      {
        path: "/api/v1/invoices/query",
        body: {
          conditions: [{ fieldCode: "application_number", operator: "CONTAINS", values: ["开票"] }],
          page: 1,
          size: 20,
        },
      },
      {
        path: "/api/v1/return-visits/query",
        body: {
          conditions: [{ fieldCode: "visit_number", operator: "CONTAINS", values: ["回访"] }],
          page: 1,
          size: 20,
        },
      },
    ]);
  });

  it("decodes a customer-context contract through the typed detail boundary", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, name: "续约", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const contract = await createApiClient(auth).getContract(8);

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/contracts/8",
    );
    expect(contract).toMatchObject({ customerId: 6, id: 8, name: "续约", version: 0 });
  });

  it("fails closed when a typed contract detail does not match its requested route ID", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 9, name: "其他合同", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getContract(8)).rejects.toThrow("合同详情数据暂时不可用");
  });

  it("reads the complete, versioned contract collaborator replacement baseline", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            callerState: "OWNER",
            collaborators: [{ access: "READ", actorId: 9, effectiveUntil: null }],
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getContractCollaboratorBaseline(8)).resolves.toEqual({
      callerState: "OWNER",
      collaborators: [{ access: "READ", actorId: 9, effectiveUntil: null }],
      version: 3,
    });
    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("GET");
    expect(request.url).toBe("http://localhost/api/v1/contracts/8/collaborators");
  });

  it("reads the complete, versioned contract product replacement baseline", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            contractId: 8,
            lines: [
              {
                productCode: "PLAN-A",
                productId: 9,
                productName: "入门套餐",
                quantity: 2,
                unitPrice: 99.9,
              },
            ],
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getContractProductBaseline(8)).resolves.toMatchObject({
      contractId: 8,
      lines: [{ productCode: "PLAN-A", productId: 9, quantity: 2, unitPrice: 99.9 }],
      version: 3,
    });
    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("GET");
    expect(request.url).toBe("http://localhost/api/v1/contracts/8/products");
  });

  it("creates a minimum customer-context contract through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, name: "续约", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).createContract({
      customerId: 6,
      name: "续约",
      number: "HT-20260726-0008",
      products: [],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/contracts");
    expect(await request.json()).toEqual({
      customerId: 6,
      name: "续约",
      number: "HT-20260726-0008",
      products: [],
    });
  });

  it("updates only explicit basic contract fields through PATCH", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            customerId: 6,
            id: 8,
            name: "续约合同",
            number: "HT-20260726-0008",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).updateContract(8, { name: "续约合同", version: 3 }),
    ).resolves.toMatchObject({ customerId: 6, id: 8, name: "续约合同", version: 4 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PATCH");
    expect(request.url).toBe("http://localhost/api/v1/contracts/8");
    expect(await request.json()).toEqual({ name: "续约合同", version: 3 });
  });

  it("replaces contract products from the dedicated generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            contractId: 8,
            lines: [
              {
                productCode: "PLAN-A",
                productId: 9,
                productName: "入门套餐",
                quantity: 3,
                unitPrice: 42,
              },
            ],
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).replaceContractProducts(8, {
        lines: [{ productId: 9, quantity: 3, unitPrice: 42 }],
        version: 3,
      }),
    ).resolves.toMatchObject({ contractId: 8, version: 4 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/contracts/8/products");
    expect(await request.json()).toEqual({
      lines: [{ productId: 9, quantity: 3, unitPrice: 42 }],
      version: 3,
    });
  });

  it("soft-deletes a contract with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteContract(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/contracts/8?version=3");
  });

  it("exports selected versioned contracts through the controlled Blob channel", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(new Blob(["合同 ID,合同名称\\n8,合同 A\\n"], { type: "text/csv" }), {
          headers: {
            "Content-Disposition": 'attachment; filename="contracts-selected.csv"',
            "Content-Type": "text/csv;charset=UTF-8",
          },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const download = await createApiClient(auth).exportSelectedContractsCsv({
      contracts: [
        { contractId: 8, version: 3 },
        { contractId: 9, version: 4 },
      ],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/contracts/batch/export/csv");
    expect(await request.json()).toEqual({
      contracts: [
        { contractId: 8, version: 3 },
        { contractId: 9, version: 4 },
      ],
    });
    expect(download).toMatchObject({
      contentType: "text/csv;charset=UTF-8",
      fileName: "contracts-selected.csv",
    });
  });

  it("updates contract owners in a versioned batch through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateContractOwners({
      contracts: [
        { contractId: 8, version: 3 },
        { contractId: 9, version: 4 },
      ],
      ownerActorId: 12,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/contracts/batch/owner");
    expect(await request.json()).toEqual({
      contracts: [
        { contractId: 8, version: 3 },
        { contractId: 9, version: 4 },
      ],
      ownerActorId: 12,
    });
  });

  it("deletes contracts in a versioned batch through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteContracts({
      contracts: [
        { contractId: 8, version: 3 },
        { contractId: 9, version: 4 },
      ],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/contracts/batch/delete");
    expect(await request.json()).toEqual({
      contracts: [
        { contractId: 8, version: 3 },
        { contractId: 9, version: 4 },
      ],
    });
  });

  it("adds contract team members in a versioned batch through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).addContractCollaborators({
      collaborators: [{ access: "WRITE", actorId: 12 }],
      contracts: [
        { contractId: 8, version: 3 },
        { contractId: 9, version: 4 },
      ],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/contracts/batch/collaborators");
    expect(await request.json()).toEqual({
      collaborators: [{ access: "WRITE", actorId: 12 }],
      contracts: [
        { contractId: 8, version: 3 },
        { contractId: 9, version: 4 },
      ],
    });
  });

  it("removes contract team members in a versioned batch through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).removeContractCollaborators({
      actorIds: [12],
      contracts: [
        { contractId: 8, version: 3 },
        { contractId: 9, version: 4 },
      ],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/contracts/batch/collaborators");
    expect(await request.json()).toEqual({
      actorIds: [12],
      contracts: [
        { contractId: 8, version: 3 },
        { contractId: 9, version: 4 },
      ],
    });
  });

  it("voids a contract with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).voidContract(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/contracts/8/void");
    expect(await request.json()).toEqual({ version: 3 });
  });

  it("updates a contract owner through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, ownerActorId: 9, version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateContractOwner(8, { ownerActorId: 9, version: 3 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/contracts/8/owner");
    expect(await request.json()).toEqual({ ownerActorId: 9, version: 3 });
  });

  it("replaces contract collaborators only from an explicit versioned request", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, ownerActorId: 7, version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).replaceContractCollaborators(8, {
      collaborators: [{ access: "WRITE", actorId: 9 }],
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/contracts/8/collaborators");
    expect(await request.json()).toEqual({
      collaborators: [{ access: "WRITE", actorId: 9 }],
      version: 3,
    });
  });

  it("exits contract collaboration with an explicit concurrency version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).exitContractCollaborator(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/contracts/8/collaborators/me?version=3");
  });

  it("reads customer invoice profiles through the generated customer query contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getInvoiceProfiles(6)).resolves.toEqual([]);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("GET");
    expect(request.url).toBe("http://localhost/api/v1/invoice-profiles?customerId=6");
  });

  it("queries customer-scoped invoices through the generated page request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getInvoices({ customerId: 6, page: 1, size: 20 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/invoices/query");
    expect(await request.json()).toEqual({ customerId: 6, page: 1, size: 20 });
  });

  it("decodes a customer-context invoice detail through the narrow boundary", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, status: "REQUESTED", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getInvoice(8)).resolves.toMatchObject({
      customerId: 6,
      id: 8,
      version: 0,
    });
    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/invoices/8",
    );
  });

  it("creates a personal customer-context invoice through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, status: "PENDING", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).createInvoice({
      amount: 12.34,
      contractId: 7,
      invoiceType: "VAT",
      title: "张三",
      titleType: "INDIVIDUAL",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/invoices");
    expect(await request.json()).toEqual({
      amount: 12.34,
      contractId: 7,
      invoiceType: "VAT",
      title: "张三",
      titleType: "INDIVIDUAL",
    });
  });

  it("partially updates an invoice through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            customerId: 6,
            id: 8,
            invoiceType: "增值税普通发票",
            requestedDate: "2026-07-26",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateInvoice(8, {
      invoiceType: "增值税普通发票",
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PATCH");
    expect(request.url).toBe("http://localhost/api/v1/invoices/8");
    expect(await request.json()).toEqual({ invoiceType: "增值税普通发票", version: 3 });
  });

  it("registers an invoice result through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            customerId: 6,
            id: 8,
            invoiceNumber: "INV-2026-001",
            issuedDate: "2026-07-26",
            status: "ISSUED",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).issueInvoice(8, {
      invoiceNumber: "INV-2026-001",
      issuedDate: "2026-07-26",
      logisticsNumber: "LOG-001",
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/invoices/8/issue");
    expect(await request.json()).toEqual({
      invoiceNumber: "INV-2026-001",
      issuedDate: "2026-07-26",
      logisticsNumber: "LOG-001",
      version: 3,
    });
  });

  it("soft-deletes an invoice with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteInvoice(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/invoices/8?version=3");
  });

  it("sends every invoice batch operation through generated versioned request contracts", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);
    const apiClient = createApiClient(auth);
    const invoices = [
      { invoiceId: 8, version: 3 },
      { invoiceId: 9, version: 4 },
    ];

    await apiClient.updateInvoiceOwners({ invoices, ownerActorId: 12 });
    await apiClient.resetInvoices({ invoices });
    await apiClient.deleteInvoices({ invoices });

    const requests = await Promise.all(
      fetch.mock.calls.map(async ([input]) => {
        const request = new Request(input as Request);
        return {
          body: await request.json(),
          method: request.method,
          pathname: new URL(request.url).pathname,
        };
      }),
    );
    expect(requests).toEqual([
      {
        body: { invoices, ownerActorId: 12 },
        method: "PUT",
        pathname: "/api/v1/invoices/batch/owner",
      },
      { body: { invoices }, method: "PUT", pathname: "/api/v1/invoices/batch/reset" },
      { body: { invoices }, method: "POST", pathname: "/api/v1/invoices/batch/delete" },
    ]);
  });

  it("resets an issued invoice with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).resetInvoice(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/invoices/8/reset");
    expect(await request.json()).toEqual({ version: 3 });
  });

  it("updates an invoice owner through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, ownerActorId: 9, version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateInvoiceOwner(8, { ownerActorId: 9, version: 3 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/invoices/8/owner");
    expect(await request.json()).toEqual({ ownerActorId: 9, version: 3 });
  });

  it("decodes a customer-context receivable detail through the narrow boundary", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, status: "ACTIVE", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getReceivable(8)).resolves.toMatchObject({
      customerId: 6,
      id: 8,
      version: 0,
    });
    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/receivables/8",
    );
  });

  it("creates an unplanned customer-context receivable through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, status: "ACTIVE", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).createReceivable({
      amount: 12.34,
      contractId: 7,
      paymentMethod: "TRANSFER",
      receivedDate: "2026-07-26",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/receivables");
    expect(await request.json()).toEqual({
      amount: 12.34,
      contractId: 7,
      paymentMethod: "TRANSFER",
      receivedDate: "2026-07-26",
    });
  });

  it("partially updates a receivable through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            customerId: 6,
            id: 8,
            receivedDate: "2026-08-26",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateReceivable(8, { receivedDate: "2026-08-26", version: 3 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PATCH");
    expect(request.url).toBe("http://localhost/api/v1/receivables/8");
    expect(await request.json()).toEqual({ receivedDate: "2026-08-26", version: 3 });
  });

  it("updates a receivable owner through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, ownerActorId: 9, version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateReceivableOwner(8, { ownerActorId: 9, version: 3 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/receivables/8/owner");
    expect(await request.json()).toEqual({ ownerActorId: 9, version: 3 });
  });

  it("soft-deletes a receivable with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteReceivable(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/receivables/8?version=3");
  });

  it("sends receivable batch owner transfer and deletion through generated request contracts", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);
    const apiClient = createApiClient(auth);
    const receivables = [
      { receivableId: 8, version: 3 },
      { receivableId: 9, version: 4 },
    ];

    await apiClient.updateReceivableOwners({ ownerActorId: 12, receivables });
    await apiClient.deleteReceivables({ receivables });

    const requests = await Promise.all(
      fetch.mock.calls.map(async ([input]) => {
        const request = new Request(input as Request);
        return {
          body: await request.json(),
          method: request.method,
          pathname: new URL(request.url).pathname,
        };
      }),
    );
    expect(requests).toEqual([
      {
        body: { ownerActorId: 12, receivables },
        method: "PUT",
        pathname: "/api/v1/receivables/batch/owner",
      },
      { body: { receivables }, method: "POST", pathname: "/api/v1/receivables/batch/delete" },
    ]);
  });

  it("decodes a customer-context receivable-plan detail through the narrow boundary", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, status: "ACTIVE", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getReceivablePlan(8)).resolves.toMatchObject({
      customerId: 6,
      id: 8,
      version: 0,
    });
    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/receivable-plans/8",
    );
  });

  it("decodes server-visible available receivable plans without retaining monetary values", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify([
            {
              contractId: 7,
              customerId: 6,
              id: 8,
              installment: 1,
              plannedAmount: 12.34,
              remainingAmount: 12.34,
              version: 0,
            },
          ]),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getAvailableReceivablePlans(7)).resolves.toEqual([
      {
        contractId: 7,
        customerId: 6,
        dueDate: null,
        id: 8,
        installment: 1,
        progress: null,
        status: null,
        version: 0,
      },
    ]);
    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/receivable-plans/available?contractId=7",
    );
  });

  it("creates a customer-context receivable plan through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ customerId: 6, id: 8, status: "ACTIVE", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).createReceivablePlan({
      contractId: 7,
      dueDate: "2026-08-26",
      paymentMethod: "TRANSFER",
      plannedAmount: 12.34,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/receivable-plans");
    expect(await request.json()).toEqual({
      contractId: 7,
      dueDate: "2026-08-26",
      paymentMethod: "TRANSFER",
      plannedAmount: 12.34,
    });
  });

  it("creates receivable plans in a batch through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify([
            { customerId: 6, id: 8, installment: 1, version: 0 },
            { customerId: 6, id: 9, installment: 2, version: 0 },
          ]),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).createReceivablePlansBatch({
      contractId: 7,
      plans: [
        { dueDate: "2026-08-26", paymentMethod: "TRANSFER", plannedAmount: 12.34 },
        { dueDate: "2026-09-26", paymentMethod: "TRANSFER", plannedAmount: 23.45 },
      ],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/receivable-plans/batch");
    expect(await request.json()).toEqual({
      contractId: 7,
      plans: [
        { dueDate: "2026-08-26", paymentMethod: "TRANSFER", plannedAmount: 12.34 },
        { dueDate: "2026-09-26", paymentMethod: "TRANSFER", plannedAmount: 23.45 },
      ],
    });
  });

  it("partially updates a receivable plan through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            customerId: 6,
            dueDate: "2026-09-26",
            id: 8,
            installment: 1,
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateReceivablePlan(8, { dueDate: "2026-09-26", version: 3 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PATCH");
    expect(request.url).toBe("http://localhost/api/v1/receivable-plans/8");
    expect(await request.json()).toEqual({ dueDate: "2026-09-26", version: 3 });
  });

  it("soft-deletes a receivable plan with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteReceivablePlan(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/receivable-plans/8?version=3");
  });

  it("creates a personal invoice profile through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            customerId: 6,
            id: 8,
            title: "张三",
            titleType: "INDIVIDUAL",
            version: 0,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const profile = await createApiClient(auth).createInvoiceProfile({
      customerId: 6,
      title: "张三",
      titleType: "INDIVIDUAL",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/invoice-profiles");
    expect(await request.json()).toEqual({
      customerId: 6,
      title: "张三",
      titleType: "INDIVIDUAL",
    });
    expect(profile).toMatchObject({ customerId: 6, id: 8, title: "张三", version: 0 });
  });

  it("updates only an explicit personal invoice-profile title through PATCH", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            customerId: 6,
            id: 8,
            title: "李四",
            titleType: "INDIVIDUAL",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).updateInvoiceProfile(8, { title: "李四", version: 3 }),
    ).resolves.toMatchObject({ customerId: 6, id: 8, title: "李四", version: 4 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PATCH");
    expect(request.url).toBe("http://localhost/api/v1/invoice-profiles/8");
    expect(await request.json()).toEqual({ title: "李四", version: 3 });
  });

  it("soft-deletes an invoice profile with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteInvoiceProfile(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/invoice-profiles/8?version=3");
  });

  it("decodes a visible contact through the typed detail boundary", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 0, jobTitle: "采购经理" }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const contact = await createApiClient(auth).getContact(8);

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/contacts/8",
    );
    expect(contact).toMatchObject({ id: 8, name: "张三", jobTitle: "采购经理" });
  });

  it("reads the server-visible contact hierarchy", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            requestedContactId: 8,
            contacts: [
              { id: 7, name: "上级联系人", parentContactId: null },
              { id: 8, name: "张三", parentContactId: 7 },
            ],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getContactHierarchy(8)).resolves.toMatchObject({
      requestedContactId: 8,
      contacts: [
        { id: 7, name: "上级联系人" },
        { id: 8, parentContactId: 7 },
      ],
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/contacts/8/hierarchy",
    );
  });

  it("reads the complete contact collaborator replacement baseline", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            version: 3,
            callerState: "OWNER",
            collaborators: [{ actorId: 9, access: "READ" }],
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getContactCollaboratorBaseline(8)).resolves.toEqual({
      version: 3,
      callerState: "OWNER",
      collaborators: [{ actorId: 9, access: "READ" }],
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/contacts/8/collaborators",
    );
  });

  it("exports a bounded contact CSV through the controlled Blob channel", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(new Blob(["contact_id,contact_name\\n8,张三\\n"], { type: "text/csv" }), {
          headers: {
            "Content-Disposition": 'attachment; filename="contacts.csv"',
            "Content-Type": "text/csv;charset=UTF-8",
          },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const download = await createApiClient(auth).exportContactsCsv({
      fieldCodes: ["contact_name"],
      keyword: "张三",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contacts/export/csv");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({ fieldCodes: ["contact_name"], keyword: "张三" });
    expect(download).toMatchObject({
      contentType: "text/csv;charset=UTF-8",
      fileName: "contacts.csv",
    });
  });

  it("checks contact duplicates without exposing matched records", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ duplicate: true }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).checkContactDuplicate({
        name: "张三",
        phoneNumber: "+8613812345678",
      }),
    ).resolves.toBe(true);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contacts/duplicate-check");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({ name: "张三", phoneNumber: "+8613812345678" });
  });

  it("creates a contact through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 0, jobTitle: "采购经理" }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const contact = await createApiClient(auth).createContact({
      name: "张三",
      jobTitle: "采购经理",
      phoneNumber: "+8613812345678",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contacts");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      name: "张三",
      jobTitle: "采购经理",
      phoneNumber: "+8613812345678",
    });
    expect(contact).toMatchObject({ id: 8, name: "张三", jobTitle: "采购经理" });
  });

  it("updates a contact and explicitly clears next-contact time with its original version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 4, jobTitle: "销售总监" }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const contact = await createApiClient(auth).updateContact(8, {
      version: 3,
      jobTitle: "销售总监",
      nextContactTime: null,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contacts/8");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({
      version: 3,
      jobTitle: "销售总监",
      nextContactTime: null,
    });
    expect(contact).toMatchObject({ id: 8, version: 4, name: "张三", jobTitle: "销售总监" });
  });

  it("clears a contact customer relation with the generated nullable request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 4, customerId: null }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateContact(8, { customerId: null, version: 3 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contacts/8");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ customerId: null, version: 3 });
  });

  it("updates the caller's personal contact star through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).setContactStarred(8, { starred: true });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contacts/8/star");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ starred: true });
  });

  it("updates the complete contact lock and deal state with the original version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({ id: 8, name: "张三", version: 4, locked: true, dealStatus: "WON" }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const contact = await createApiClient(auth).updateContactState(8, {
      version: 3,
      locked: true,
      dealStatus: "WON",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contacts/8/state");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ version: 3, locked: true, dealStatus: "WON" });
    expect(contact).toMatchObject({ id: 8, version: 4, locked: true, dealStatus: "WON" });
  });

  it("replaces contact tags with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", tags: ["重点联系人"], version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const contact = await createApiClient(auth).replaceContactTags(8, {
      tags: ["重点联系人"],
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/contacts/8/tags");
    expect(await request.json()).toEqual({ tags: ["重点联系人"], version: 3 });
    expect(contact).toMatchObject({ id: 8, tags: ["重点联系人"], version: 4 });
  });

  it("changes tags for a versioned contact batch through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).changeContactTags({
      contacts: [{ contactId: 8, version: 3 }],
      removedTags: ["已归档"],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contacts/batch/tags");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      contacts: [{ contactId: 8, version: 3 }],
      removedTags: ["已归档"],
    });
  });

  it("transfers versioned contacts through the generated batch-owner contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateContactOwners({
      ownerActorId: 9,
      contacts: [{ contactId: 8, version: 3 }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contacts/batch/owner");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({
      ownerActorId: 9,
      contacts: [{ contactId: 8, version: 3 }],
    });
  });

  it("deletes versioned contacts through the generated batch-delete contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteContacts({ contacts: [{ contactId: 8, version: 3 }] });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contacts/batch/delete");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({ contacts: [{ contactId: 8, version: 3 }] });
  });

  it("sets or clears the contact parent with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 4, parentContactId: 9 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateContactParent(8, { version: 3, parentContactId: 9 });
    await createApiClient(auth).updateContactParent(8, { version: 4 });

    const setRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(setRequest.url).toBe("http://localhost/api/v1/contacts/8/parent");
    expect(await setRequest.json()).toEqual({ version: 3, parentContactId: 9 });
    expect(await new Request(fetch.mock.calls[1]?.[0] as Request).json()).toEqual({ version: 4 });
  });

  it("updates a contact owner with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 4, ownerActorId: 9 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const contact = await createApiClient(auth).updateContactOwner(8, {
      version: 3,
      ownerActorId: 9,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contacts/8/owner");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ version: 3, ownerActorId: 9 });
    expect(contact.ownerActorId).toBe(9);
  });

  it("replaces contact collaborators with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "张三", version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).replaceContactCollaborators(8, {
      version: 3,
      collaborators: [{ actorId: 9, access: "WRITE" }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/contacts/8/collaborators");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({
      version: 3,
      collaborators: [{ actorId: 9, access: "WRITE" }],
    });
  });

  it("exits contact collaboration with the caller's current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).exitContactCollaborator(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/contacts/8/collaborators/me?version=3");
  });

  it("deletes a contact with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteContact(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/contacts/8?version=3");
  });

  it("creates a customer through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "New Acme", version: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const customer = await createApiClient(auth).createCustomer({
      name: "New Acme",
      phoneNumber: "+8613812345678",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/customers");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({ name: "New Acme", phoneNumber: "+8613812345678" });
    expect(customer).toMatchObject({ id: 8, name: "New Acme" });
  });

  it("updates a customer with its original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "Updated Acme", version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const customer = await createApiClient(auth).updateCustomer(8, {
      version: 3,
      description: "更新后的说明",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/customers/8");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ version: 3, description: "更新后的说明" });
    expect(customer).toMatchObject({ id: 8, version: 4, name: "Updated Acme" });
  });

  it("exports bounded receivable plans through the controlled Blob channel", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(new Blob(["receivable_plan_id,plan_number\\n8,1\\n"], { type: "text/csv" }), {
          headers: {
            "Content-Disposition": 'attachment; filename="receivable-plans.csv"',
            "Content-Type": "text/csv;charset=UTF-8",
          },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const download = await createApiClient(auth).exportReceivablePlansCsv({
      conditions: [{ fieldCode: "due_date", operator: "GTE", values: ["2026-08-01"] }],
      customerId: 8,
      fieldCodes: ["plan_number", "planned_amount"],
      keyword: "1",
      subordinateOwnerOnly: true,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/receivable-plans/export/csv");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      conditions: [{ fieldCode: "due_date", operator: "GTE", values: ["2026-08-01"] }],
      customerId: 8,
      fieldCodes: ["plan_number", "planned_amount"],
      keyword: "1",
      subordinateOwnerOnly: true,
    });
    expect(download).toMatchObject({
      contentType: "text/csv;charset=UTF-8",
      fileName: "receivable-plans.csv",
    });
  });

  it("exports a bounded customer CSV through the controlled Blob channel", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(new Blob(["customer_id,customer_name\\n8,Acme\\n"], { type: "text/csv" }), {
          headers: {
            "Content-Disposition": 'attachment; filename="customers.csv"',
            "Content-Type": "text/csv;charset=UTF-8",
          },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const download = await createApiClient(auth).exportCustomersCsv({
      conditions: [{ fieldCode: "customer_name", operator: "CONTAINS", values: ["Acme"] }],
      fieldCodes: ["customer_name"],
      keyword: "Acme",
      subordinateOwnerOnly: true,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/customers/export/csv");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      conditions: [{ fieldCode: "customer_name", operator: "CONTAINS", values: ["Acme"] }],
      fieldCodes: ["customer_name"],
      keyword: "Acme",
      subordinateOwnerOnly: true,
    });
    expect(download).toMatchObject({
      contentType: "text/csv;charset=UTF-8",
      fileName: "customers.csv",
    });
  });

  it("changes tags for a versioned customer batch through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).changeCustomerTags({
      customers: [{ customerId: 8, version: 3 }],
      addedTags: ["重点客户"],
      removedTags: ["待跟进"],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/customers/batch/tags");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({
      customers: [{ customerId: 8, version: 3 }],
      addedTags: ["重点客户"],
      removedTags: ["待跟进"],
    });
  });

  it("updates the caller's personal customer star through the generated request contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).setCustomerStarred(8, { starred: true });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/customers/8/star");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ starred: true });
  });

  it("decodes a visible customer through the typed detail boundary", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({ id: 7, name: "Acme", version: 0, status: "ACTIVE", tags: ["重点"] }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const customer = await createApiClient(auth).getCustomer(7);

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/customers/7",
    );
    expect(customer).toMatchObject({ id: 7, name: "Acme", status: "ACTIVE", tags: ["重点"] });
  });

  it("reads the unmasked server-authorized customer tag catalog", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(["重点客户", "华东"]), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getCustomerTagCatalog()).resolves.toEqual([
      "重点客户",
      "华东",
    ]);
    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/customers/tags",
    );
  });

  it("replaces customer tags with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 7, name: "Acme", tags: ["重点客户"], version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const customer = await createApiClient(auth).replaceCustomerTags(7, {
      tags: ["重点客户"],
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/customers/7/tags");
    expect(await request.json()).toEqual({ tags: ["重点客户"], version: 3 });
    expect(customer).toMatchObject({ id: 7, tags: ["重点客户"], version: 4 });
  });

  it("reads the server-authorized fixed customer business overview", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            customerId: 7,
            cards: [
              { source: "CONTACT", status: "AVAILABLE", count: 2 },
              { source: "OPEN_OPPORTUNITY", status: "AVAILABLE", count: 0, amount: 12.5 },
              { source: "ACTIVE_CONTRACT", status: "UNAVAILABLE" },
              { source: "PENDING_INVOICE", status: "AVAILABLE", count: 0, amount: 0 },
              { source: "ACTIVE_RECEIVABLE", status: "AVAILABLE", count: 0, amount: 0 },
              { source: "ACTIVE_RECEIVABLE_PLAN", status: "AVAILABLE", count: 0, amount: 0 },
              { source: "RETURN_VISIT", status: "AVAILABLE", count: 1 },
            ],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const overview = await createApiClient(auth).getCustomerBusinessOverview(7);

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/customers/7/business-overview",
    );
    expect(overview.cards).toContainEqual({
      source: "ACTIVE_CONTRACT",
      status: "UNAVAILABLE",
      count: null,
      amount: null,
    });
  });

  it("checks customer duplicates without exposing matched records", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ duplicate: true }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).checkCustomerDuplicate({ name: "Acme", phoneNumber: "+8613812345678" }),
    ).resolves.toBe(true);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/customers/duplicate-check");
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual({ name: "Acme", phoneNumber: "+8613812345678" });
  });

  it("queries only server-visible active members for selection", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            objectList: [{ actorId: 7, displayName: "张三", active: true }],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getVisibleMembers({ page: 1, size: 50 })).resolves.toEqual([
      { actorId: 7, displayName: "张三" },
    ]);

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/organization/members?page=1&size=50",
    );
  });

  it("queries members only through the selected server-visible department", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            objectList: [{ active: true, actorId: 7, displayName: "张三" }],
            pageNum: 2,
            pageSize: 15,
            totalNum: 16,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).getOrganizationDepartmentMembers(8, {
        includeDescendants: true,
        keyword: "张",
        page: 2,
        size: 15,
      }),
    ).resolves.toMatchObject({
      pageNum: 2,
      pageSize: 15,
      totalNum: 16,
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/organization/departments/8/members?includeDescendants=true&keyword=%E5%BC%A0&page=2&size=15",
    );
  });

  it("updates only the caller's explicit local profile fields", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            actorId: 7,
            displayName: "张三",
            email: "zhangsan@example.com",
            phoneNumber: "+8613812345678",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).updateMyProfile({
        displayName: "张三",
        email: "zhangsan@example.com",
        phoneNumber: "+8613812345678",
      }),
    ).resolves.toMatchObject({ actorId: 7, displayName: "张三" });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/organization/profile");
    expect(await request.json()).toEqual({
      displayName: "张三",
      email: "zhangsan@example.com",
      phoneNumber: "+8613812345678",
    });
  });

  it("updates a customer owner with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "Acme", version: 4, ownerActorId: 9 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const customer = await createApiClient(auth).updateCustomerOwner(8, {
      version: 3,
      ownerActorId: 9,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/customers/8/owner");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ version: 3, ownerActorId: 9 });
    expect(customer.ownerActorId).toBe(9);
  });

  it("reads the complete customer collaborator replacement baseline", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            version: 3,
            callerState: "OWNER",
            collaborators: [{ actorId: 9, access: "READ" }],
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getCustomerCollaboratorBaseline(8)).resolves.toEqual({
      version: 3,
      callerState: "OWNER",
      collaborators: [{ actorId: 9, access: "READ" }],
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/customers/8/collaborators",
    );
  });

  it("replaces customer collaborators with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "Acme", version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).replaceCustomerCollaborators(8, {
      version: 3,
      collaborators: [{ actorId: 9, access: "WRITE" }],
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/customers/8/collaborators");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({
      version: 3,
      collaborators: [{ actorId: 9, access: "WRITE" }],
    });
  });

  it("exits customer collaboration with the caller's current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).exitCustomerCollaborator(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/customers/8/collaborators/me?version=3");
  });

  it("reads the server-visible customer hierarchy", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            requestedCustomerId: 8,
            customers: [
              { id: 7, name: "集团", parentCustomerId: null },
              { id: 8, name: "Acme", parentCustomerId: 7 },
            ],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getCustomerHierarchy(8)).resolves.toMatchObject({
      requestedCustomerId: 8,
      customers: [
        { id: 7, name: "集团" },
        { id: 8, parentCustomerId: 7 },
      ],
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/customers/8/hierarchy",
    );
  });

  it("sets or clears the customer parent with the original optimistic-lock version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 8, name: "Acme", version: 4, parentCustomerId: 9 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateCustomerParent(8, { version: 3, parentCustomerId: 9 });
    await createApiClient(auth).updateCustomerParent(8, { version: 4 });

    const setRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(setRequest.url).toBe("http://localhost/api/v1/customers/8/parent");
    expect(await setRequest.json()).toEqual({ version: 3, parentCustomerId: 9 });
    expect(await new Request(fetch.mock.calls[1]?.[0] as Request).json()).toEqual({ version: 4 });
  });

  it("updates the complete customer lock and deal state with its original version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({ id: 8, name: "Acme", version: 4, locked: true, dealStatus: "WON" }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).updateCustomerState(8, {
      version: 3,
      locked: true,
      dealStatus: "WON",
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/customers/8/state");
    expect(request.method).toBe("PUT");
    expect(await request.json()).toEqual({ version: 3, locked: true, dealStatus: "WON" });
  });

  it("deletes a customer with its current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).deleteCustomer(8, 3);

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/customers/8?version=3");
  });

  it("requests field definitions with inactive fields excluded and decodes the response", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify([
            {
              code: "industry",
              displayName: "行业",
              fieldType: "SELECT",
              status: "ACTIVE",
              options: [{ value: "software", label: "软件" }],
            },
          ]),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const definitions = await createApiClient(auth).getFieldDefinitions("CUSTOMER");

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/fields/objects/CUSTOMER?includeInactive=false",
    );
    expect(definitions[0]).toMatchObject({
      code: "industry",
      fieldType: "SELECT",
      options: [{ value: "software", label: "软件", order: 0 }],
    });
  });

  it("decodes the current member field layout", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            objectType: "CUSTOMER",
            orderedCodes: ["industry"],
            hiddenCodes: [],
            pinnedCodes: ["industry"],
            columnWidths: { industry: 220 },
            version: 2,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const layout = await createApiClient(auth).getFieldLayout("CUSTOMER");

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/fields/objects/CUSTOMER/layout",
    );
    expect(layout).toMatchObject({
      objectType: "CUSTOMER",
      orderedCodes: ["industry"],
      pinnedCodes: ["industry"],
      columnWidths: { industry: 220 },
      version: 2,
    });
  });

  it("downloads protected attachment content through the authenticated client", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response("protected content", {
          headers: {
            "Content-Disposition": "attachment; filename*=UTF-8''customer.txt",
            "Content-Type": "text/plain",
          },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const download = await createApiClient(auth).downloadAttachment({
      targetType: "customer",
      targetId: 7,
      fileId: 8,
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/attachment-targets/customer/7/attachments/8/content",
    );
    expect(download.fileName).toBe("customer.txt");
    expect(download.blob.size).toBe(17);
  });

  it("downloads a server-projected product FILE attachment through the authenticated client", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response("controlled specification", {
          headers: {
            "Content-Disposition": "attachment; filename=specification.pdf",
            "Content-Type": "application/pdf",
          },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const download = await createApiClient(auth).downloadFileField({
      fieldCode: "specification",
      fileId: 8,
      targetId: 7,
      targetType: "product",
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/attachment-targets/product/7/file-fields/specification/8/content",
    );
    expect(download.fileName).toBe("specification.pdf");
    expect(download.blob.size).toBe(24);
  });

  it("downloads a server-projected OA request FILE through the authenticated client", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response("approval evidence", {
          headers: {
            "Content-Disposition": "attachment; filename=travel-proof.pdf",
            "Content-Type": "application/pdf",
          },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const download = await createApiClient(auth).downloadOaRequestFileField({
      fieldCode: "travel_proof",
      fileId: 8,
      requestId: 7,
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/oa/requests/7/file-fields/travel_proof/8/content",
    );
    expect(download.fileName).toBe("travel-proof.pdf");
    expect(download.blob.size).toBe(17);
  });

  it("lists Work task attachments through the authenticated target endpoint", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [], pageNum: 1, pageSize: 20, totalNum: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getWorkTaskAttachments(8, { page: 1, size: 20 });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/attachment-targets/work-task/8/attachments?page=1&size=20",
    );
  });

  it("executes the controlled attachment lifecycle with an authenticated binary upload", async () => {
    const responses = [
      {
        declaredMediaType: "application/pdf",
        displayName: "活动方案.pdf",
        draftId: 18,
        expectedBytes: 7,
        expiresAt: "2099-01-01T00:00:00Z",
        fileId: 19,
        status: "UPLOADING",
        version: 0,
      },
      "accepted",
      { status: "ACCEPTED_FOR_INSPECTION", version: 1 },
      { objectList: [], pageNum: 1, pageSize: 20, totalNum: 0 },
      null,
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        const body = responses.shift();
        return new Response(body === null ? null : JSON.stringify(body), {
          headers: { "Content-Type": "application/json" },
          status: body === "accepted" ? 202 : 200,
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);
    const target = { targetId: 12, targetType: "marketing-activity" as const };

    await expect(
      client.uploadAttachments(target, [new File(["content"], "活动方案.pdf")]),
    ).resolves.toEqual([{ fileId: 19, status: { status: "ACCEPTED_FOR_INSPECTION", version: 1 } }]);
    await expect(client.getAttachments(target, { page: 1, size: 20 })).resolves.toMatchObject({
      totalNum: 0,
    });
    await expect(client.withdrawAttachment({ ...target, fileId: 19 }, 1)).resolves.toBeUndefined();

    const intentRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    const uploadRequest = new Request(
      fetch.mock.calls[1]?.[0] as RequestInfo,
      fetch.mock.calls[1]?.[1],
    );
    expect(intentRequest.method).toBe("POST");
    await expect(intentRequest.json()).resolves.toEqual({
      declaredMediaType: "application/pdf",
      displayName: "活动方案.pdf",
      expectedBytes: 7,
    });
    expect(uploadRequest.method).toBe("PUT");
    expect(uploadRequest.headers.get("content-type")).toBe("application/octet-stream");
    await expect(uploadRequest.text()).resolves.toBe("content");
    expect(uploadRequest.url).toBe(
      "http://localhost/api/v1/attachment-targets/marketing-activity/12/attachments/19/content?version=0",
    );
    expect(new Request(fetch.mock.calls[2]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/attachment-targets/marketing-activity/12/attachments/19/upload-status",
    );
    expect(new Request(fetch.mock.calls[3]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/attachment-targets/marketing-activity/12/attachments?page=1&size=20",
    );
    expect(new Request(fetch.mock.calls[4]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/attachment-targets/marketing-activity/12/attachments/19?version=1",
    );
  });

  it("stages an existing CRM FILE field candidate through the target-bound controlled lifecycle", async () => {
    const responses = [
      {
        declaredMediaType: "application/pdf",
        displayName: "资质证明.pdf",
        draftId: 27,
        expectedBytes: 7,
        expiresAt: "2099-01-01T00:00:00Z",
        fileId: 28,
        status: "UPLOADING",
        version: 0,
      },
      "accepted",
      { status: "ACCEPTED_FOR_INSPECTION", version: 1 },
      { status: "INDETERMINATE", version: 2 },
      null,
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        const body = responses.shift();
        return new Response(body === null ? null : JSON.stringify(body), {
          headers: { "Content-Type": "application/json" },
          status: body === "accepted" ? 202 : 200,
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);
    const target = { targetId: 7, targetType: "product" as const };

    await expect(
      client.uploadExistingCrmFileFieldFiles(target, "qualification", [
        new File(["content"], "资质证明.pdf", { type: "application/pdf" }),
      ]),
    ).resolves.toEqual({
      fieldCode: "qualification",
      files: [
        {
          displayName: "资质证明.pdf",
          fileId: 28,
          status: { status: "ACCEPTED_FOR_INSPECTION", version: 1 },
        },
      ],
    });
    await expect(client.getAttachmentUploadStatus(target, 28)).resolves.toEqual({
      status: "INDETERMINATE",
      version: 2,
    });
    await expect(client.withdrawAttachment({ ...target, fileId: 28 }, 2)).resolves.toBeUndefined();

    const intentRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(intentRequest.url).toBe(
      "http://localhost/api/v1/attachment-targets/product/7/file-fields/qualification/upload-intents",
    );
    await expect(intentRequest.json()).resolves.toEqual({
      declaredMediaType: "application/pdf",
      displayName: "资质证明.pdf",
      expectedBytes: 7,
    });
    expect(new Request(fetch.mock.calls[1]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/attachment-targets/product/7/attachments/28/content?version=0",
    );
    expect(new Request(fetch.mock.calls[2]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/attachment-targets/product/7/attachments/28/upload-status",
    );
    expect(new Request(fetch.mock.calls[3]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/attachment-targets/product/7/attachments/28/upload-status",
    );
    expect(new Request(fetch.mock.calls[4]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/attachment-targets/product/7/attachments/28?version=2",
    );
  });

  it("withdraws already-created product FILE candidates if a later upload fails", async () => {
    const responses = [
      {
        declaredMediaType: "application/pdf",
        displayName: "第一份.pdf",
        draftId: 27,
        expectedBytes: 5,
        expiresAt: "2099-01-01T00:00:00Z",
        fileId: 28,
        status: "UPLOADING",
        version: 0,
      },
      "accepted",
      { status: "ACCEPTED_FOR_INSPECTION", version: 1 },
      {
        declaredMediaType: "application/pdf",
        displayName: "第二份.pdf",
        draftId: 27,
        expectedBytes: 6,
        expiresAt: "2099-01-01T00:00:00Z",
        fileId: 29,
        status: "UPLOADING",
        version: 0,
      },
      "rejected",
      { status: "ACCEPTED_FOR_INSPECTION", version: 1 },
      null,
      { status: "UPLOADING", version: 0 },
      null,
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        const body = responses.shift();
        return new Response(body === null ? null : JSON.stringify(body), {
          headers: { "Content-Type": "application/json" },
          status: body === "accepted" ? 202 : body === "rejected" ? 503 : 200,
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);
    const target = { targetId: 7, targetType: "product" as const };

    await expect(
      client.uploadExistingCrmFileFieldFiles(target, "qualification", [
        new File(["first"], "第一份.pdf", { type: "application/pdf" }),
        new File(["second"], "第二份.pdf", { type: "application/pdf" }),
      ]),
    ).rejects.toBeInstanceOf(ApiError);

    const requests = fetch.mock.calls.map(
      ([input, init]) => new Request(input as RequestInfo, init),
    );
    expect(requests[5]?.url).toBe(
      "http://localhost/api/v1/attachment-targets/product/7/attachments/28/upload-status",
    );
    expect(requests[6]?.url).toBe(
      "http://localhost/api/v1/attachment-targets/product/7/attachments/28?version=1",
    );
    expect(requests[6]?.method).toBe("DELETE");
    expect(requests[7]?.url).toBe(
      "http://localhost/api/v1/attachment-targets/product/7/attachments/29/upload-status",
    );
    expect(requests[8]?.url).toBe(
      "http://localhost/api/v1/attachment-targets/product/7/attachments/29?version=0",
    );
    expect(requests[8]?.method).toBe("DELETE");
  });

  it("stages CRM CSV imports through a private draft before the atomic confirmation", async () => {
    const responses = [
      { columns: ["name", "phoneNumber"], objectType: "LEAD" },
      {
        attachmentTargetType: "import-draft",
        draftId: 41,
        expiresAt: "2099-01-01T00:00:00Z",
        objectType: "LEAD",
        status: "DRAFT",
        version: 0,
      },
      {
        declaredMediaType: "text/csv",
        displayName: "线索.csv",
        draftId: 41,
        expectedBytes: 5,
        expiresAt: "2099-01-01T00:00:00Z",
        fileId: 51,
        status: "UPLOADING",
        version: 0,
      },
      "accepted",
      { status: "ACCEPTED_FOR_INSPECTION", version: 0 },
      { status: "AVAILABLE", version: 1 },
      { draftId: 41, issues: [], objectType: "LEAD", status: "READY", validRows: 1 },
      { draftId: 41, importedRows: 1, objectType: "LEAD", status: "CONSUMED", version: 1 },
      null,
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        const body = responses.shift();
        return new Response(body === null ? null : JSON.stringify(body), {
          headers: { "Content-Type": "application/json" },
          status: body === "accepted" ? 202 : 200,
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);
    const file = new File(["name\n"], "线索.csv", { type: "text/csv" });

    await expect(client.getCrmImportTemplate("LEAD")).resolves.toMatchObject({
      columns: ["name", "phoneNumber"],
    });
    const draft = await client.createCrmImportDraft("LEAD");
    await expect(client.uploadCrmImportDraftSource(41, file)).resolves.toEqual({
      fileId: 51,
      status: { status: "ACCEPTED_FOR_INSPECTION", version: 0 },
    });
    await expect(client.getCrmImportDraftSourceStatus(41, 51)).resolves.toMatchObject({
      status: "AVAILABLE",
    });
    await expect(client.getCrmImportDraftPreview(41)).resolves.toMatchObject({ validRows: 1 });
    await expect(client.confirmCrmImportDraft(41, 0)).resolves.toMatchObject({ importedRows: 1 });
    await expect(client.withdrawCrmImportDraft(41, 0)).resolves.toBeUndefined();
    expect(draft).toMatchObject({ draftId: 41, version: 0 });

    const requests = fetch.mock.calls.map(
      ([input, init]) => new Request(input as RequestInfo, init),
    );
    expect(requests.map((request) => request.url)).toEqual([
      "http://localhost/api/v1/crm-import-drafts/templates/LEAD",
      "http://localhost/api/v1/crm-import-drafts",
      "http://localhost/api/v1/attachment-targets/import-draft/41/attachments/upload-intents",
      "http://localhost/api/v1/attachment-targets/import-draft/41/attachments/51/content?version=0",
      "http://localhost/api/v1/attachment-targets/import-draft/41/attachments/51/upload-status",
      "http://localhost/api/v1/attachment-targets/import-draft/41/attachments/51/upload-status",
      "http://localhost/api/v1/crm-import-drafts/41/preview",
      "http://localhost/api/v1/crm-import-drafts/41/confirm",
      "http://localhost/api/v1/crm-import-drafts/41?version=0",
    ]);
    await expect(requests[1]?.json()).resolves.toEqual({ objectType: "LEAD" });
    await expect(requests[2]?.json()).resolves.toEqual({
      declaredMediaType: "text/csv",
      displayName: "线索.csv",
      expectedBytes: 5,
    });
    expect(requests[3]?.headers.get("content-type")).toBe("application/octet-stream");
    await expect(requests[3]?.text()).resolves.toBe("name\n");
    await expect(requests[7]?.json()).resolves.toEqual({ version: 0 });
  });

  it("downloads CRM import errors as an authenticated controlled Blob", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response("\uFEFFrowNumber,errCode\r\n3,CSV_ROW_VALIDATION_FAILED\r\n", {
          headers: {
            "Content-Disposition": 'attachment; filename="crm-import-errors.csv"',
            "Content-Type": "text/csv;charset=UTF-8",
          },
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    const download = await client.downloadCrmImportDraftErrorReport(41);

    expect(download.fileName).toBe("crm-import-errors.csv");
    expect(download.blob).toBeInstanceOf(Blob);
    expect(download.blob.size).toBe(
      new Blob(["\uFEFFrowNumber,errCode\r\n3,CSV_ROW_VALIDATION_FAILED\r\n"]).size,
    );
    const request = new Request(fetch.mock.calls[0]?.[0] as RequestInfo, fetch.mock.calls[0]?.[1]);
    expect(request.url).toBe("http://localhost/api/v1/crm-import-drafts/41/error-report");
    expect(request.method).toBe("GET");
  });

  it("reads only the typed page of current-member CRM import history", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            items: [{ completedAt: "2026-08-11T04:00:00", draftId: 41, importedRows: 2 }],
            page: 2,
            size: 20,
            total: 21,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getCrmImportHistory("PRODUCT", 2)).resolves.toMatchObject({
      items: [{ draftId: 41, importedRows: 2 }],
      page: 2,
      total: 21,
    });
    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/crm-import-drafts/history/PRODUCT?page=2&size=20",
    );
  });

  it("sends and filters the closed marketing activity image groups", async () => {
    const responses = [
      {
        declaredMediaType: "image/png",
        displayName: "cover.png",
        draftId: 28,
        expectedBytes: 7,
        expiresAt: "2099-01-01T00:00:00Z",
        fileId: 29,
        status: "UPLOADING",
        version: 0,
      },
      "accepted",
      { status: "ACCEPTED_FOR_INSPECTION", version: 1 },
      { objectList: [], pageNum: 1, pageSize: 9, totalNum: 0 },
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        const body = responses.shift();
        return new Response(body === null ? null : JSON.stringify(body), {
          headers: { "Content-Type": "application/json" },
          status: body === "accepted" ? 202 : 200,
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);
    const target = { targetId: 12, targetType: "marketing-activity" as const };

    await client.uploadAttachments(target, [new File(["content"], "cover.png")], {
      marketingActivityImageType: "COVER",
    });
    await client.getAttachments(target, {
      marketingActivityImageType: "COVER",
      page: 1,
      size: 9,
    });

    const intentRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    await expect(intentRequest.json()).resolves.toEqual({
      declaredMediaType: "image/png",
      displayName: "cover.png",
      expectedBytes: 7,
      marketingActivityImageType: "COVER",
    });
    expect(new Request(fetch.mock.calls[3]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/attachment-targets/marketing-activity/12/attachments?marketingActivityImageType=COVER&page=1&size=9",
    );
  });

  it("stages product images privately before product creation and filters persisted groups", async () => {
    const responses = [
      { draftId: 51, expiresAt: "2099-01-01T00:00:00Z", version: 0 },
      {
        draftId: 51,
        expiresAt: "2099-01-01T00:00:00Z",
        fileId: 61,
        headers: { "Content-Length": "7", "Content-Type": "application/octet-stream" },
        imageType: "PRIMARY",
        method: "PUT",
        uploadUrl: "/api/v1/product-image-drafts/51/images/PRIMARY/files/61/content?version=0",
      },
      { accepted: true },
      {
        displayName: "primary.png",
        draftId: 51,
        fileId: 61,
        imageType: "PRIMARY",
        mediaType: "image/png",
        size: 7,
        status: "UPLOADED",
      },
      { objectList: [], pageNum: 1, pageSize: 9, totalNum: 0 },
      null,
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        const body = responses.shift();
        return new Response(body === null ? null : JSON.stringify(body), {
          headers: { "Content-Type": "application/json" },
          status: body !== null && typeof body === "object" && "accepted" in body ? 202 : 200,
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    const draft = await client.createProductImageDraft();
    await expect(
      client.uploadProductImageDraftFiles(draft, "PRIMARY", [
        new File(["content"], "primary.png", { type: "image/png" }),
      ]),
    ).resolves.toMatchObject({ files: [{ fileId: 61, status: "UPLOADED" }] });
    await expect(
      client.getAttachments(
        { targetId: 12, targetType: "product" },
        { page: 1, productImageType: "PRIMARY", size: 9 },
      ),
    ).resolves.toMatchObject({ totalNum: 0 });
    await client.withdrawProductImageDraft(51, 0);

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toBe("http://localhost/api/v1/product-image-drafts");
    expect(requests[1]?.url).toBe(
      "http://localhost/api/v1/product-image-drafts/51/images/PRIMARY/upload-intents",
    );
    await expect(requests[1]?.json()).resolves.toEqual({
      declaredMediaType: "image/png",
      displayName: "primary.png",
      expectedBytes: 7,
      productImageType: "PRIMARY",
    });
    expect(requests[2]?.url).toBe(
      "http://localhost:3000/api/v1/product-image-drafts/51/images/PRIMARY/files/61/content?version=0",
    );
    expect(requests[3]?.url).toBe(
      "http://localhost/api/v1/product-image-drafts/51/images/PRIMARY/files/61/upload-status",
    );
    expect(requests[4]?.url).toBe(
      "http://localhost/api/v1/attachment-targets/product/12/attachments?page=1&productImageType=PRIMARY&size=9",
    );
    expect(requests[5]?.url).toBe("http://localhost/api/v1/product-image-drafts/51?version=0");
  });

  it("queries server-visible Work tasks through the generated request body", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [], pageNum: 1, pageSize: 20, totalNum: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).getWorkTasks({ page: 1, size: 20, statuses: ["TODO"] }),
    ).resolves.toEqual({ objectList: [], pageNum: 1, pageSize: 20, totalNum: 0 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/work/tasks/query");
    expect(await request.json()).toEqual({ page: 1, size: 20, statuses: ["TODO"] });
  });

  it("queries server-visible Work task series through the generated page parameters", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).getWorkTaskSeries({ page: 2, size: 50 });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/work/task-series?page=2&size=50",
    );
  });

  it("reads and replaces only the current member's typed notification preferences", async () => {
    let requestCount = 0;
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        requestCount += 1;
        const preference =
          requestCount === 1
            ? { emailEnabled: false, oaAnnouncementEmailEnabled: true }
            : { emailEnabled: true, oaAnnouncementEmailEnabled: false };
        return new Response(JSON.stringify(preference), {
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getNotificationPreference()).resolves.toEqual({
      emailEnabled: false,
      oaAnnouncementEmailEnabled: true,
    });
    await expect(
      client.updateNotificationPreference({
        emailEnabled: true,
        oaAnnouncementEmailEnabled: false,
      }),
    ).resolves.toEqual({ emailEnabled: true, oaAnnouncementEmailEnabled: false });

    const getRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    const putRequest = new Request(fetch.mock.calls[1]?.[0] as Request);
    expect(getRequest.method).toBe("GET");
    expect(getRequest.url).toBe("http://localhost/api/v1/notifications/preferences");
    expect(putRequest.method).toBe("PUT");
    expect(putRequest.url).toBe("http://localhost/api/v1/notifications/preferences");
    await expect(putRequest.json()).resolves.toEqual({
      emailEnabled: true,
      oaAnnouncementEmailEnabled: false,
    });
  });

  it("queries and marks current-member Work notifications read without task data", async () => {
    let requestCount = 0;
    const notification = (status: "UNREAD" | "READ") => ({
      dueTime: "2026-07-27T09:30:00",
      id: 8,
      kind: "WORK_TASK_REMINDER",
      priority: "HIGH",
      status,
      taskId: 9,
      title: "提交周报",
    });
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        requestCount += 1;
        const payload =
          requestCount === 1
            ? { objectList: [notification("UNREAD")], pageNum: 1, pageSize: 20, totalNum: 1 }
            : notification("READ");
        return new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getNotifications({ page: 1, size: 20, unreadOnly: true })).resolves.toEqual(
      { objectList: [notification("UNREAD")], pageNum: 1, pageSize: 20, totalNum: 1 },
    );
    await expect(client.markNotificationRead(8)).resolves.toEqual({
      dueTime: "2026-07-27T09:30:00",
      id: 8,
      kind: "WORK_TASK_REMINDER",
      priority: "HIGH",
      status: "READ",
      title: "提交周报",
    });

    const queryRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    const readRequest = new Request(fetch.mock.calls[1]?.[0] as Request);
    expect(queryRequest.method).toBe("GET");
    expect(queryRequest.url).toBe(
      "http://localhost/api/v1/notifications?page=1&size=20&unreadOnly=true",
    );
    expect(readRequest.method).toBe("POST");
    expect(readRequest.url).toBe("http://localhost/api/v1/notifications/8/read");
  });

  it("queries only the current member's pending approval page and discards approval facts", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            objectList: [
              {
                applicantActorId: 9,
                allowedActions: ["APPROVE", "REJECT"],
                facts: { discount: ["80"] },
                id: 8,
                objectType: "CUSTOMER",
                status: "PENDING",
                subjectId: 7,
                title: "审批客户折扣",
                version: 3,
              },
            ],
            totalNum: 1,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getPendingApprovals({ page: 1, size: 20 })).resolves.toEqual(
      {
        items: [
          {
            allowedActions: ["APPROVE", "REJECT"],
            id: 8,
            status: "PENDING",
            title: "审批客户折扣",
            version: 3,
          },
        ],
        total: 1,
      },
    );

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/approvals/query");
    await expect(request.json()).resolves.toEqual({ bucket: "PENDING", page: 1, size: 20 });
  });

  it("reads a server-visible approval timeline without retaining tasks, facts, or actors", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            applicantActorId: 9,
            allowedActions: ["APPROVE", "TRANSFER"],
            facts: { discount: ["80"] },
            id: 8,
            status: "PENDING",
            tasks: [
              {
                actedTime: "2026-07-26T10:00:00",
                assignedActorId: 10,
                remark: "不应进入浏览器缓存",
                status: "APPROVED",
                stepName: "直属负责人",
                stepOrder: 1,
                taskKey: "task-1",
              },
            ],
            title: "审批客户折扣",
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getApprovalPendingDetail(8)).resolves.toEqual({
      allowedActions: ["APPROVE", "TRANSFER"],
      id: 8,
      status: "PENDING",
      tasks: [
        {
          actedTime: "2026-07-26T10:00:00",
          status: "APPROVED",
          stepName: "直属负责人",
          stepOrder: 1,
        },
      ],
      title: "审批客户折扣",
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("GET");
    expect(request.url).toBe("http://localhost/api/v1/approvals/8");
  });

  it("queries service-authorized approval definitions without retaining routing configuration", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            objectList: [
              {
                id: 8,
                initiatorActorIds: [9],
                managerActorIds: [10],
                name: "客户折扣审批",
                objectType: "CUSTOMER",
                status: "ACTIVE",
                steps: [{ conditions: [{ fieldCode: "discount", values: ["80"] }] }],
                version: 3,
              },
            ],
            totalNum: 1,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).getApprovalDefinitions({ page: 1, size: 20 }),
    ).resolves.toEqual({
      items: [{ id: 8, name: "客户折扣审批", objectType: "CUSTOMER", status: "ACTIVE" }],
      total: 1,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/approval-definitions/query");
    await expect(request.json()).resolves.toEqual({ page: 1, size: 20 });
  });

  it("creates an inactive approval-definition draft and discards its routing configuration", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            id: 8,
            initiatorActorIds: [],
            managerActorIds: [10],
            name: "客户折扣审批",
            objectType: "CUSTOMER",
            repeatMode: "ONCE",
            status: "INACTIVE",
            steps: [{ fallback: "MANAGERS", memberActorIds: [9], name: "审批成员" }],
            version: 0,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const request = {
      managerActorIds: [10],
      name: "客户折扣审批",
      objectType: "CUSTOMER",
      repeatMode: "ONCE",
      steps: [
        {
          code: "step-1",
          fallback: "MANAGERS",
          memberActorIds: [9],
          mode: "ANY",
          name: "审批成员",
          order: 0,
          type: "MEMBER",
        },
      ],
    } satisfies import("~/api/generated/schema").components["schemas"]["ApprovalDefinitionRequest"];

    await expect(createApiClient(auth).createApprovalDefinition(request)).resolves.toEqual({
      id: 8,
      name: "客户折扣审批",
      objectType: "CUSTOMER",
      status: "INACTIVE",
    });

    const posted = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(posted.method).toBe("POST");
    expect(posted.url).toBe("http://localhost/api/v1/approval-definitions");
    await expect(posted.json()).resolves.toEqual(request);
  });

  it("uses a narrow server definition baseline for an explicit status update", async () => {
    let requestCount = 0;
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        requestCount += 1;
        return new Response(
          JSON.stringify({
            description: "不应进入浏览器缓存",
            id: 8,
            managerActorIds: [10],
            name: "客户折扣审批",
            objectType: "CUSTOMER",
            status: requestCount === 1 ? "INACTIVE" : "ACTIVE",
            steps: [{ conditions: [{ fieldCode: "discount", values: ["80"] }] }],
            version: requestCount === 1 ? 3 : 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getApprovalDefinitionStatus(8)).resolves.toEqual({
      id: 8,
      status: "INACTIVE",
      version: 3,
    });
    await expect(
      client.updateApprovalDefinitionStatus(8, { status: "ACTIVE", version: 3 }),
    ).resolves.toEqual({
      id: 8,
      status: "ACTIVE",
      version: 4,
    });

    const readRequest = new Request(fetch.mock.calls[0]?.[0] as Request);
    const statusRequest = new Request(fetch.mock.calls[1]?.[0] as Request);
    expect(readRequest.method).toBe("GET");
    expect(readRequest.url).toBe("http://localhost/api/v1/approval-definitions/8");
    expect(statusRequest.method).toBe("PUT");
    expect(statusRequest.url).toBe("http://localhost/api/v1/approval-definitions/8/status");
    await expect(statusRequest.json()).resolves.toEqual({ status: "ACTIVE", version: 3 });
  });

  it("reads and replaces only a verified inactive minimal approval template", async () => {
    let requestCount = 0;
    const payload = (version: number, name: string) => ({
      id: 8,
      initiatorActorIds: [],
      initiatorDepartmentIds: [],
      managerActorIds: [10],
      name,
      objectType: "CUSTOMER",
      repeatMode: "ONCE",
      status: "INACTIVE",
      steps: [
        {
          code: "step-1",
          conditions: [],
          fallback: "MANAGERS",
          memberActorIds: [9],
          mode: "ANY",
          name: "审批成员",
          order: 0,
          roleIds: [],
          type: "MEMBER",
        },
      ],
      version,
    });
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        requestCount += 1;
        return new Response(
          JSON.stringify(
            payload(
              requestCount === 1 ? 3 : 4,
              requestCount === 1 ? "客户折扣审批" : "更新后的审批",
            ),
          ),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);
    const baseline = await client.getApprovalDefinitionEditableBaseline(8);
    const request = {
      managerActorIds: [10],
      name: "更新后的审批",
      objectType: "CUSTOMER",
      repeatMode: "ONCE",
      steps: payload(3, "x").steps,
      version: 3,
    } satisfies import("~/api/generated/schema").components["schemas"]["ApprovalDefinitionRequest"];

    await expect(client.updateApprovalDefinition(8, request)).resolves.toMatchObject({
      id: 8,
      name: "更新后的审批",
      version: 4,
    });
    expect(baseline).toMatchObject({ id: 8, name: "客户折扣审批", version: 3 });
    const putRequest = new Request(fetch.mock.calls[1]?.[0] as Request);
    expect(putRequest.method).toBe("PUT");
    expect(putRequest.url).toBe("http://localhost/api/v1/approval-definitions/8");
    await expect(putRequest.json()).resolves.toEqual(request);
  });

  it("creates a draft Work task series and requires its typed mutation result", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            id: 8,
            allowedActions: ["UPDATE", "ACTIVATE"],
            status: "DRAFT",
            version: 0,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).createWorkTaskSeries({
        assigneeActorId: 9,
        localTime: "09:30:00",
        recurrenceFrequency: "WEEKLY",
        recurrenceInterval: 2,
        startLocalDate: "2026-08-01",
        title: "每两周回顾",
        weekdays: ["MONDAY", "WEDNESDAY"],
        zoneId: "Asia/Shanghai",
      }),
    ).resolves.toEqual({
      allowedActions: ["UPDATE", "ACTIVATE"],
      id: 8,
      status: "DRAFT",
      version: 0,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/work/task-series");
    expect(await request.json()).toEqual({
      assigneeActorId: 9,
      localTime: "09:30:00",
      recurrenceFrequency: "WEEKLY",
      recurrenceInterval: 2,
      startLocalDate: "2026-08-01",
      title: "每两周回顾",
      weekdays: ["MONDAY", "WEDNESDAY"],
      zoneId: "Asia/Shanghai",
    });
  });

  it("stops future Work task series occurrences with only the current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ allowedActions: [], id: 8, status: "STOPPED", version: 4 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).deleteWorkTaskSeries(8, 3)).resolves.toEqual({
      allowedActions: [],
      id: 8,
      status: "STOPPED",
      version: 4,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/work/task-series/8?version=3");
  });

  it("pauses an active Work task series with only the current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            allowedActions: ["UPDATE", "ACTIVATE", "STOP"],
            id: 8,
            status: "PAUSED",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).pauseWorkTaskSeries(8, 3)).resolves.toEqual({
      allowedActions: ["UPDATE", "ACTIVATE", "STOP"],
      id: 8,
      status: "PAUSED",
      version: 4,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/work/task-series/8/pause");
    await expect(request.json()).resolves.toEqual({ version: 3 });
  });

  it("uses typed detail, full replacement, and server-advertised activation for Work task series", async () => {
    let requestCount = 0;
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        requestCount += 1;
        const payload =
          requestCount === 1
            ? {
                actionBlockers: [],
                allowedActions: ["UPDATE", "ACTIVATE"],
                assigneeActorId: 9,
                description: "每周回访",
                followerActorIds: [10],
                id: 8,
                priority: "HIGH",
                recurrence: {
                  endLocalDate: null,
                  frequency: "WEEKLY",
                  interval: 2,
                  lastDayOfMonth: false,
                  localTime: "09:30:00",
                  monthDay: null,
                  startLocalDate: "2026-08-01",
                  weekdays: ["MONDAY"],
                  zoneId: "Asia/Shanghai",
                },
                status: "PAUSED",
                title: "每周回访",
                version: 3,
              }
            : requestCount === 2
              ? { allowedActions: ["ACTIVATE"], id: 8, status: "PAUSED", version: 4 }
              : { allowedActions: ["UPDATE", "PAUSE"], id: 8, status: "ACTIVE", version: 5 };
        return new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getWorkTaskSeriesDetail(8)).resolves.toMatchObject({
      allowedActions: ["UPDATE", "ACTIVATE"],
      assigneeActorId: 9,
      id: 8,
      priority: "HIGH",
    });
    await expect(
      client.updateWorkTaskSeries(8, {
        assigneeActorId: 9,
        description: "每周回访",
        followerActorIds: [10],
        localTime: "09:30:00",
        priority: "HIGH",
        recurrenceFrequency: "WEEKLY",
        recurrenceInterval: 2,
        startLocalDate: "2026-08-01",
        title: "每周回访",
        version: 3,
        weekdays: ["MONDAY"],
        zoneId: "Asia/Shanghai",
      }),
    ).resolves.toMatchObject({ id: 8, status: "PAUSED", version: 4 });
    await expect(client.activateWorkTaskSeries(8, 4)).resolves.toMatchObject({
      id: 8,
      status: "ACTIVE",
      version: 5,
    });

    const [detailRequest, updateRequest, activateRequest] = fetch.mock.calls.map(
      ([input]) => new Request(input as Request),
    );
    expect(detailRequest?.url).toBe("http://localhost/api/v1/work/task-series/8");
    expect(updateRequest?.method).toBe("PUT");
    expect(await updateRequest?.json()).toMatchObject({ version: 3 });
    expect(activateRequest?.url).toBe("http://localhost/api/v1/work/task-series/8/activate");
    await expect(activateRequest?.json()).resolves.toEqual({ version: 4 });
  });

  it("reads the narrow server-visible Work task projection and authorized business-record reference", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            businessObjectType: "CUSTOMER",
            businessRecordId: 7,
            currentAssigneeActorId: 9,
            description: "不应进入浏览器缓存",
            dueTime: "2026-07-27T09:00:00",
            id: 8,
            overdue: false,
            priority: "HIGH",
            status: "TODO",
            title: "回访客户",
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getWorkTask(8)).resolves.toEqual({
      businessRecord: { objectType: "CUSTOMER", recordId: 7 },
      dueTime: "2026-07-27T09:00:00",
      id: 8,
      overdue: false,
      priority: "HIGH",
      status: "TODO",
      title: "回访客户",
      version: 3,
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/work/tasks/8",
    );
  });

  it("creates a Work task from the generated basic request without retaining its structure", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            assigneeActorId: 9,
            description: "不应进入浏览器缓存",
            dueTime: "2026-07-27T09:00:00",
            id: 8,
            overdue: false,
            priority: "NORMAL",
            status: "TODO",
            title: "回访客户",
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).createWorkTask({
        assigneeActorId: 9,
        dueTime: "2026-07-27T09:00",
        title: "回访客户",
      }),
    ).resolves.toEqual({
      businessRecord: null,
      dueTime: "2026-07-27T09:00:00",
      id: 8,
      overdue: false,
      priority: "NORMAL",
      status: "TODO",
      title: "回访客户",
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/work/tasks");
    expect(await request.json()).toEqual({
      assigneeActorId: 9,
      dueTime: "2026-07-27T09:00",
      title: "回访客户",
    });
  });

  it("reads a manager-only task structure baseline and writes its complete generated update", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            businessRecordId: 7,
            createdByActorId: 9,
            currentAssigneeActorId: 10,
            description: "确认下周安排",
            dueTime: "2026-07-27T09:00:00",
            followerActorIds: [11],
            id: 8,
            overdue: false,
            priority: "HIGH",
            status: "TODO",
            title: "回访客户",
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getWorkTaskEditBaseline(8)).resolves.toEqual({
      description: "确认下周安排",
      dueTime: "2026-07-27T09:00:00",
      id: 8,
      priority: "HIGH",
      status: "TODO",
      title: "回访客户",
      version: 3,
    });
    await expect(
      client.updateWorkTask(8, {
        description: "确认下周安排",
        dueTime: "2026-07-30T09:00",
        priority: "HIGH",
        title: "回访重点客户",
        version: 3,
      }),
    ).resolves.toMatchObject({ id: 8, title: "回访客户", version: 3 });

    const [baselineRequest, updateRequest] = fetch.mock.calls.map(
      ([input]) => new Request(input as Request),
    );
    expect(baselineRequest?.url).toBe("http://localhost/api/v1/work/tasks/8");
    expect(updateRequest?.method).toBe("PUT");
    expect(updateRequest?.url).toBe("http://localhost/api/v1/work/tasks/8");
    expect(await updateRequest?.json()).toEqual({
      description: "确认下周安排",
      dueTime: "2026-07-30T09:00",
      priority: "HIGH",
      title: "回访重点客户",
      version: 3,
    });
  });

  it("reassigns an open Work task through the generated versioned contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            id: 8,
            overdue: false,
            status: "TODO",
            title: "回访客户",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).updateWorkTaskAssignee(8, { assigneeActorId: 10, version: 3 }),
    ).resolves.toMatchObject({ id: 8, title: "回访客户", version: 4 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/work/tasks/8/assignee");
    expect(await request.json()).toEqual({ assigneeActorId: 10, version: 3 });
  });

  it("reads a complete follower baseline and replaces followers with the generated versioned contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            currentAssigneeActorId: 9,
            followerActorIds: [10, 11],
            id: 8,
            overdue: false,
            status: "TODO",
            title: "回访客户",
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getWorkTaskFollowerBaseline(8)).resolves.toEqual({
      followerActorIds: [10, 11],
      id: 8,
      status: "TODO",
      version: 3,
    });
    await expect(
      client.replaceWorkTaskFollowers(8, { followerActorIds: [11, 12], version: 3 }),
    ).resolves.toMatchObject({ id: 8, title: "回访客户", version: 3 });

    const [baselineRequest, updateRequest] = fetch.mock.calls.map(
      ([input]) => new Request(input as Request),
    );
    expect(baselineRequest?.url).toBe("http://localhost/api/v1/work/tasks/8");
    expect(updateRequest?.method).toBe("PUT");
    expect(updateRequest?.url).toBe("http://localhost/api/v1/work/tasks/8/followers");
    expect(await updateRequest?.json()).toEqual({ followerActorIds: [11, 12], version: 3 });
  });

  it("reads and replaces a task reminder plan from its dedicated versioned baseline", async () => {
    let requestCount = 0;
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        requestCount += 1;
        return new Response(
          JSON.stringify({
            notificationProjectionVersion: 7,
            seriesId: null,
            steps: [
              {
                offsetMinutes: 0,
                recipientRoles: ["ASSIGNEE"],
                stepKey: "AT_DUE_0_ASSIGNEE",
                timing: "AT_DUE",
              },
            ],
            taskId: 8,
            version: requestCount === 1 ? 3 : 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getWorkTaskReminderPlan(8)).resolves.toEqual({
      steps: [{ offsetMinutes: 0, recipientRoles: ["ASSIGNEE"], timing: "AT_DUE" }],
      taskId: 8,
      version: 3,
    });
    await expect(
      client.replaceWorkTaskReminderPlan(8, {
        steps: [
          { offsetMinutes: 15, recipientRoles: ["ASSIGNEE", "FOLLOWERS"], timing: "BEFORE_DUE" },
        ],
        version: 3,
      }),
    ).resolves.toEqual({
      steps: [{ offsetMinutes: 0, recipientRoles: ["ASSIGNEE"], timing: "AT_DUE" }],
      taskId: 8,
      version: 4,
    });

    const [baselineRequest, updateRequest] = fetch.mock.calls.map(
      ([input]) => new Request(input as Request),
    );
    expect(baselineRequest?.method).toBe("GET");
    expect(baselineRequest?.url).toBe("http://localhost/api/v1/work/tasks/8/reminders");
    expect(updateRequest?.method).toBe("PUT");
    expect(updateRequest?.url).toBe("http://localhost/api/v1/work/tasks/8/reminders");
    expect(await updateRequest?.json()).toEqual({
      steps: [
        { offsetMinutes: 15, recipientRoles: ["ASSIGNEE", "FOLLOWERS"], timing: "BEFORE_DUE" },
      ],
      version: 3,
    });
  });

  it("reads and replaces a future-series reminder template from its dedicated baseline", async () => {
    let requestCount = 0;
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        requestCount += 1;
        return new Response(
          JSON.stringify({
            notificationProjectionVersion: null,
            seriesId: 9,
            steps: [
              {
                offsetMinutes: 0,
                recipientRoles: ["ASSIGNEE"],
                stepKey: "AT_DUE_0_ASSIGNEE",
                timing: "AT_DUE",
              },
            ],
            taskId: null,
            version: requestCount === 1 ? 3 : 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getWorkTaskSeriesReminderPlan(9)).resolves.toEqual({
      seriesId: 9,
      steps: [{ offsetMinutes: 0, recipientRoles: ["ASSIGNEE"], timing: "AT_DUE" }],
      version: 3,
    });
    await expect(
      client.replaceWorkTaskSeriesReminderPlan(9, {
        steps: [
          { offsetMinutes: 15, recipientRoles: ["ASSIGNEE", "FOLLOWERS"], timing: "BEFORE_DUE" },
        ],
        version: 3,
      }),
    ).resolves.toEqual({
      seriesId: 9,
      steps: [{ offsetMinutes: 0, recipientRoles: ["ASSIGNEE"], timing: "AT_DUE" }],
      version: 4,
    });

    const [baselineRequest, updateRequest] = fetch.mock.calls.map(
      ([input]) => new Request(input as Request),
    );
    expect(baselineRequest?.method).toBe("GET");
    expect(baselineRequest?.url).toBe("http://localhost/api/v1/work/task-series/9/reminders");
    expect(updateRequest?.method).toBe("PUT");
    expect(updateRequest?.url).toBe("http://localhost/api/v1/work/task-series/9/reminders");
    expect(await updateRequest?.json()).toEqual({
      steps: [
        { offsetMinutes: 15, recipientRoles: ["ASSIGNEE", "FOLLOWERS"], timing: "BEFORE_DUE" },
      ],
      version: 3,
    });
  });

  it("pages immutable Work task series occurrences through the generated query contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ objectList: [], pageNum: 2, pageSize: 20, totalNum: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).getWorkTaskSeriesOccurrences(9, { page: 2, size: 20 }),
    ).resolves.toEqual({ objectList: [], pageNum: 2, pageSize: 20, totalNum: 0 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("GET");
    expect(request.url).toBe(
      "http://localhost/api/v1/work/task-series/9/occurrences?page=2&size=20",
    );
  });

  it("clears a Work task business record without reading or replaying its old relation", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            id: 8,
            overdue: false,
            status: "TODO",
            title: "回访客户",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).clearWorkTaskBusinessRecord(8, { version: 3 }),
    ).resolves.toMatchObject({ id: 8, title: "回访客户", version: 4 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/work/tasks/8/business-record");
    expect(await request.json()).toEqual({ version: 3 });
  });

  it("updates a Work task business record through the generated versioned contract", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            businessObjectType: "CUSTOMER",
            businessRecordId: 27,
            id: 8,
            overdue: false,
            status: "TODO",
            title: "回访客户",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).updateWorkTaskBusinessRecord(8, {
        businessObjectType: "CUSTOMER",
        businessRecordId: 27,
        version: 3,
      }),
    ).resolves.toMatchObject({
      businessRecord: { objectType: "CUSTOMER", recordId: 27 },
      id: 8,
      version: 4,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/work/tasks/8/business-record");
    await expect(request.json()).resolves.toEqual({
      businessObjectType: "CUSTOMER",
      businessRecordId: 27,
      version: 3,
    });
  });

  it("updates Work task progress with only the current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            id: 8,
            overdue: false,
            status: "IN_PROGRESS",
            title: "回访客户",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.startWorkTask(8, { version: 3 })).resolves.toMatchObject({
      id: 8,
      status: "IN_PROGRESS",
      version: 4,
    });
    await expect(client.returnWorkTaskToTodo(8, { version: 4 })).resolves.toMatchObject({
      id: 8,
      status: "IN_PROGRESS",
      version: 4,
    });
    await expect(client.completeWorkTask(8, { version: 5 })).resolves.toMatchObject({
      id: 8,
      status: "IN_PROGRESS",
      version: 4,
    });

    const [startRequest, returnRequest, completeRequest] = fetch.mock.calls.map(
      ([input]) => new Request(input as Request),
    );
    expect(startRequest?.url).toBe("http://localhost/api/v1/work/tasks/8/start");
    expect(await startRequest?.json()).toEqual({ version: 3 });
    expect(returnRequest?.url).toBe("http://localhost/api/v1/work/tasks/8/return-to-todo");
    expect(await returnRequest?.json()).toEqual({ version: 4 });
    expect(completeRequest?.url).toBe("http://localhost/api/v1/work/tasks/8/complete");
    expect(await completeRequest?.json()).toEqual({ version: 5 });
  });

  it("cancels an open Work task with only the generated current version", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            id: 8,
            overdue: false,
            status: "CANCELLED",
            title: "回访客户",
            version: 4,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).cancelWorkTask(8, { version: 3 })).resolves.toMatchObject({
      id: 8,
      status: "CANCELLED",
      version: 4,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/work/tasks/8/cancel");
    expect(await request.json()).toEqual({ version: 3 });
  });

  it("deletes a Work task with the generated version query", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).deleteWorkTask(8, 3)).resolves.toBeUndefined();

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost/api/v1/work/tasks/8?version=3");
  });

  it("reads and creates task-bound comments without retaining their author", async () => {
    let requestCount = 0;
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => {
        requestCount += 1;
        const comment = {
          content: "已确认下周回访时间。",
          createdTime: "2026-07-26T09:00:00",
          id: 12,
          taskId: 8,
          version: 3,
        };
        const payload =
          requestCount === 1
            ? { objectList: [comment], pageNum: 1, pageSize: 20, totalNum: 1 }
            : comment;
        return new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getWorkTaskComments(8, { page: 1, size: 20 })).resolves.toMatchObject({
      pageNum: 1,
      pageSize: 20,
      totalNum: 1,
    });
    await expect(
      client.createWorkTaskComment(8, { content: "已确认下周回访时间。" }),
    ).resolves.toEqual({
      content: "已确认下周回访时间。",
      createdTime: "2026-07-26T09:00:00",
      id: 12,
      taskId: 8,
      version: 3,
    });

    const [queryRequest, createRequest] = fetch.mock.calls.map(
      ([input]) => new Request(input as Request),
    );
    expect(queryRequest?.url).toBe("http://localhost/api/v1/work/tasks/8/comments?page=1&size=20");
    expect(createRequest?.url).toBe("http://localhost/api/v1/work/tasks/8/comments");
    expect(await createRequest?.json()).toEqual({ content: "已确认下周回访时间。" });
  });

  it("uses only a server-issued approval version and action capability for approval writes", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            instance: {
              allowedActions: [],
              id: 8,
              status: "APPROVED",
              tasks: [],
              title: "客户折扣审批",
              version: 4,
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(
      client.actOnApproval(8, {
        action: "TRANSFER",
        remark: "请继续处理",
        transferActorId: 9,
        version: 3,
      }),
    ).resolves.toMatchObject({ id: 8, status: "APPROVED", version: 4 });
    await expect(client.withdrawApproval(8, 4)).resolves.toMatchObject({ id: 8, version: 4 });
    await expect(client.cancelApproval(8, 5)).resolves.toMatchObject({ id: 8, version: 4 });

    const [actRequest, withdrawRequest, cancelRequest] = fetch.mock.calls.map(
      ([input]) => new Request(input as Request),
    );
    expect(actRequest?.url).toBe("http://localhost/api/v1/approvals/8/actions");
    expect(await actRequest?.json()).toEqual({
      action: "TRANSFER",
      remark: "请继续处理",
      transferActorId: 9,
      version: 3,
    });
    expect(withdrawRequest?.url).toBe("http://localhost/api/v1/approvals/8/withdraw?version=4");
    expect(cancelRequest?.url).toBe("http://localhost/api/v1/approvals/8/cancel?version=5");
  });

  it("lists only the server-validated transfer candidates for an approval action", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            objectList: [{ actorId: 9, displayName: "李莉", roleIds: [3] }],
            totalNum: 1,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).getApprovalTransferCandidates(8, { page: 1, size: 50 }),
    ).resolves.toEqual({ candidates: [{ actorId: 9, displayName: "李莉" }], total: 1 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe(
      "http://localhost/api/v1/approvals/8/transfer-candidates?page=1&size=50",
    );
  });

  it("accepts a batch result only when every requested approval appears in the atomic response", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            applied: true,
            atomic: true,
            items: [
              { errCode: "NONE", instanceId: 8, status: "APPLIED", version: 4 },
              { errCode: "NONE", instanceId: 9, status: "APPLIED", version: 6 },
            ],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).batchActOnApprovals({
        actions: [
          { action: "APPROVE", instanceId: 8, remark: "同意", version: 3 },
          { action: "APPROVE", instanceId: 9, remark: "同意", version: 5 },
        ],
      }),
    ).resolves.toMatchObject({ applied: true, atomic: true });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/approvals/actions/batch");
    expect(await request.json()).toEqual({
      actions: [
        { action: "APPROVE", instanceId: 8, remark: "同意", version: 3 },
        { action: "APPROVE", instanceId: 9, remark: "同意", version: 5 },
      ],
    });
  });

  it("rejects a malformed or partial batch response before the UI can update its cache", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            applied: true,
            atomic: true,
            items: [{ errCode: "NONE", instanceId: 8, status: "APPLIED", version: 4 }],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).batchActOnApprovals({
        actions: [
          { action: "APPROVE", instanceId: 8, version: 3 },
          { action: "APPROVE", instanceId: 9, version: 5 },
        ],
      }),
    ).rejects.toThrow("批量审批响应暂时不可用");
  });

  it("uses only record-bound approval start options, candidates, preview, and submission routes", async () => {
    const payloads = [
      {
        objectType: "CUSTOMER",
        options: [
          {
            definitionId: 18,
            name: "客户折扣审批",
            selections: [{ code: "regional-owner", name: "区域负责人" }],
          },
        ],
        subjectId: 8,
      },
      { objectList: [{ actorId: 9, displayName: "李莉" }], totalNum: 1 },
      {
        definitionId: 18,
        executable: true,
        steps: [{ name: "区域负责人审批", selectionRequired: true }],
        subjectId: 8,
      },
      {
        allowedActions: [],
        id: 71,
        status: "PENDING",
        tasks: [],
        title: "客户折扣审批",
        version: 1,
      },
    ];
    let responseIndex = 0;
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(payloads[responseIndex++]), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getApprovalStartOptions("CUSTOMER", 8)).resolves.toMatchObject({
      options: [{ definitionId: 18 }],
    });
    await expect(
      client.getApprovalStartSelectionCandidates("CUSTOMER", 8, 18, "regional-owner", {
        page: 1,
        size: 50,
      }),
    ).resolves.toEqual({ candidates: [{ actorId: 9, displayName: "李莉" }], total: 1 });
    await expect(
      client.previewApprovalRoute(18, {
        selectedApprovers: { "regional-owner": [9] },
        subjectId: 8,
      }),
    ).resolves.toMatchObject({ definitionId: 18, executable: true, subjectId: 8 });
    await expect(
      client.submitApproval({
        definitionId: 18,
        idempotencyKey: "a66a98db-0f51-4f44-ae2e-6af12d446bf9",
        selectedApprovers: { "regional-owner": [9] },
        subjectId: 8,
      }),
    ).resolves.toMatchObject({ id: 71, status: "PENDING" });

    const requests = fetch.mock.calls.map(([input]) => new Request(input as Request));
    expect(requests[0]?.url).toBe(
      "http://localhost/api/v1/approvals/subjects/CUSTOMER/8/start-options",
    );
    expect(requests[1]?.url).toBe(
      "http://localhost/api/v1/approvals/subjects/CUSTOMER/8/start-options/18/selections/regional-owner/candidates?page=1&size=50",
    );
    expect(requests[2]?.url).toBe("http://localhost/api/v1/approval-definitions/18/preview");
    expect(await requests[2]?.json()).toEqual({
      selectedApprovers: { "regional-owner": [9] },
      subjectId: 8,
    });
    expect(requests[3]?.url).toBe("http://localhost/api/v1/approvals");
    expect(await requests[3]?.json()).toEqual({
      definitionId: 18,
      idempotencyKey: "a66a98db-0f51-4f44-ae2e-6af12d446bf9",
      selectedApprovers: { "regional-owner": [9] },
      subjectId: 8,
    });
  });

  it("queries the server-authorized stage workflow directory without local filters", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            objectList: [
              {
                allowedActions: ["UPDATE"],
                id: 8,
                name: "客户资格确认",
                objectType: "CUSTOMER",
                status: "INACTIVE",
                version: 3,
              },
            ],
            totalNum: 1,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getStageWorkflows({ page: 1, size: 20 })).resolves.toEqual({
      items: [{ id: 8, name: "客户资格确认", objectType: "CUSTOMER", version: 3 }],
      total: 1,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://localhost/api/v1/stage-workflows/query");
    expect(await request.json()).toEqual({ page: 1, size: 20 });
  });

  it("reads a complete stage workflow definition through the generated detail route", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            failureName: "未完成",
            id: 8,
            name: "客户资格确认",
            objectType: "CUSTOMER",
            stages: [
              {
                code: "qualification",
                name: "资格确认",
                order: 1,
                probability: 20,
                requiredFieldCodes: [],
                tasks: [],
              },
            ],
            successName: "已完成",
            version: 3,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient(auth).getStageWorkflow(8)).resolves.toMatchObject({
      id: 8,
      stages: [{ name: "资格确认" }],
      version: 3,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.url).toBe("http://localhost/api/v1/stage-workflows/8");
  });

  it("uses typed workflow configuration catalogs, editable baselines, and versioned mutations", async () => {
    const observed: { body: unknown; method: string; url: string }[] = [];
    const editableWorkflow = {
      allowedActions: ["UPDATE", "CHANGE_STATUS"],
      allowedStatuses: ["ACTIVE"],
      applicableActorIds: [9],
      applicableDepartmentIds: [3],
      createdTime: "2026-07-28T09:00:00Z",
      failureName: "未完成",
      id: 8,
      name: "客户资格确认",
      objectType: "CUSTOMER",
      stages: [
        {
          code: "qualification",
          editable: true,
          name: "资格确认",
          order: 0,
          probability: 20,
          requiredFieldCodes: [],
          tasks: [],
        },
      ],
      status: "INACTIVE",
      successName: "已完成",
      updatedTime: "2026-07-28T10:00:00Z",
      version: 4,
    };
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async (input, init) => {
        const request = new Request(input, init);
        observed.push({
          body:
            request.method === "POST" || request.method === "PUT"
              ? await request.clone().json()
              : undefined,
          method: request.method,
          url: request.url,
        });
        if (
          request.url ===
          "http://localhost/api/v1/stage-workflows/configuration-options?objectType=CUSTOMER"
        ) {
          return new Response(
            JSON.stringify({
              approvalDefinitions: [{ id: 21, name: "客户资质审批", version: 3 }],
              fields: [
                {
                  code: "industry",
                  displayName: "所属行业",
                  fieldType: "SELECT",
                  requiredFieldEligible: true,
                  writable: true,
                },
              ],
              objectTypes: [{ code: "CUSTOMER", displayName: "客户" }],
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          request.url.startsWith(
            "http://localhost/api/v1/stage-workflows/configuration-options/candidates?",
          )
        ) {
          return new Response(
            JSON.stringify({
              objectList: [{ displayName: "王小明", id: 9, valueType: "MEMBER" }],
              pageNum: 1,
              pageSize: 50,
              totalNum: 1,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          request.url === "http://localhost/api/v1/stage-workflows/8" &&
          request.method === "GET"
        ) {
          return new Response(JSON.stringify(editableWorkflow), {
            headers: { "Content-Type": "application/json" },
          });
        }
        if (
          request.url === "http://localhost/api/v1/stage-workflows" &&
          request.method === "POST"
        ) {
          return new Response(JSON.stringify({ id: 9, status: "INACTIVE", version: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        if (request.url === "http://localhost/api/v1/stage-workflows/8/status") {
          return new Response(JSON.stringify({ id: 8, status: "ACTIVE", version: 6 }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        if (
          request.url === "http://localhost/api/v1/stage-workflows/8" &&
          request.method === "PUT"
        ) {
          return new Response(JSON.stringify({ id: 8, status: "INACTIVE", version: 5 }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);
    const request = {
      applicableActorIds: [9],
      applicableDepartmentIds: [3],
      failureName: "未完成",
      name: "客户资格确认",
      objectType: "CUSTOMER" as const,
      stages: [],
      successName: "已完成",
    };

    await expect(client.getStageWorkflowConfigurationOptions("CUSTOMER")).resolves.toMatchObject({
      objectTypes: [{ code: "CUSTOMER" }],
    });
    await expect(
      client.getStageWorkflowConfigurationCandidates("MEMBER", { page: 1, size: 50 }),
    ).resolves.toEqual({
      candidates: [{ displayName: "王小明", id: 9, valueType: "MEMBER" }],
      page: 1,
      size: 50,
      total: 1,
    });
    await expect(client.getStageWorkflowEditableBaseline(8)).resolves.toMatchObject({
      canChangeStatus: true,
      canUpdate: true,
      id: 8,
      version: 4,
    });
    await expect(client.createStageWorkflow(request)).resolves.toEqual({
      id: 9,
      status: "INACTIVE",
      version: 0,
    });
    await expect(client.updateStageWorkflow(8, { ...request, version: 4 })).resolves.toEqual({
      id: 8,
      status: "INACTIVE",
      version: 5,
    });
    await expect(
      client.updateStageWorkflowStatus(8, { status: "ACTIVE", version: 5 }),
    ).resolves.toEqual({
      id: 8,
      status: "ACTIVE",
      version: 6,
    });

    expect(observed.map((request) => request.url)).toEqual([
      "http://localhost/api/v1/stage-workflows/configuration-options?objectType=CUSTOMER",
      "http://localhost/api/v1/stage-workflows/configuration-options/candidates?page=1&size=50&candidateType=MEMBER",
      "http://localhost/api/v1/stage-workflows/8",
      "http://localhost/api/v1/stage-workflows",
      "http://localhost/api/v1/stage-workflows/8",
      "http://localhost/api/v1/stage-workflows/8/status",
    ]);
    expect(observed[3]?.body).toEqual(request);
    expect(observed[4]?.body).toEqual({ ...request, version: 4 });
    expect(observed[5]?.body).toEqual({ status: "ACTIVE", version: 5 });
  });

  it("uses server-confirmed applicability to start and read one stage workflow record", async () => {
    const record = {
      allowedActions: ["COMMENT"],
      allowedTaskCodes: [],
      currentStage: {
        name: "资格确认",
        order: 1,
        tasks: [{ name: "确认负责人", required: true }],
      },
      id: 71,
      objectType: "CUSTOMER",
      recordId: 8,
      status: "ACTIVE",
      version: 3,
      workflowId: 18,
      writableFieldCodes: [],
      writableFields: [],
    };
    const payloads = [
      {
        objectType: "CUSTOMER",
        recordId: 8,
        workflows: [{ blockerCode: null, canStart: true, name: "客户资格确认", workflowId: 18 }],
      },
      record,
      record,
    ];
    let responseIndex = 0;
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(payloads[responseIndex++]), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getApplicableStageWorkflows("CUSTOMER", 8)).resolves.toMatchObject({
      workflows: [{ canStart: true, workflowId: 18 }],
    });
    await expect(client.startStageWorkflow(18, 8)).resolves.toMatchObject({
      id: 71,
      status: "ACTIVE",
    });
    await expect(client.getStageWorkflowRecord(71)).resolves.toMatchObject({
      currentStage: { name: "资格确认" },
      id: 71,
    });

    const requests = fetch.mock.calls.map(([input]) => new Request(input as Request));
    expect(requests[0]?.url).toBe(
      "http://localhost/api/v1/stage-workflows/applicable?objectType=CUSTOMER&recordId=8",
    );
    expect(requests[1]?.method).toBe("POST");
    expect(requests[1]?.url).toBe("http://localhost/api/v1/stage-workflows/18/records/8");
    expect(requests[2]?.url).toBe("http://localhost/api/v1/stage-workflow-records/71");
  });

  it("uses canonical stage-workflow comment routes with only server-issued delete capability and version", async () => {
    const comment = {
      canDelete: true,
      content: "已确认客户资料齐全。",
      createdTime: "2026-07-28T15:00:00",
      id: 12,
      version: 3,
      workflowRecordId: 71,
    };
    const payloads = [{ objectList: [comment], totalNum: 1 }, comment, { deleted: true, id: 12 }];
    let responseIndex = 0;
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(payloads[responseIndex++]), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getStageWorkflowComments(71, { page: 1, size: 20 })).resolves.toEqual({
      items: [comment],
      total: 1,
    });
    await expect(
      client.createStageWorkflowComment(71, { content: "已确认客户资料齐全。" }),
    ).resolves.toEqual(comment);
    await expect(client.deleteStageWorkflowComment(71, 12, 3)).resolves.toBeUndefined();

    const requests = fetch.mock.calls.map(([input]) => new Request(input as Request));
    expect(requests[0]?.url).toBe(
      "http://localhost/api/v1/stage-workflow-records/71/comments?page=1&size=20",
    );
    expect(requests[1]?.method).toBe("POST");
    expect(requests[1]?.url).toBe("http://localhost/api/v1/stage-workflow-records/71/comments");
    expect(await requests[1]?.json()).toEqual({ content: "已确认客户资料齐全。" });
    expect(requests[2]?.method).toBe("DELETE");
    expect(requests[2]?.url).toBe(
      "http://localhost/api/v1/stage-workflow-records/71/comments/12?version=3",
    );
  });

  it("advances only with the generated canonical request and a same-record versioned response", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            record: {
              allowedActions: ["COMMENT"],
              allowedTaskCodes: [],
              currentStage: { name: "合同确认", order: 2, tasks: [] },
              id: 71,
              objectType: "CUSTOMER",
              recordId: 8,
              status: "ACTIVE",
              version: 4,
              workflowId: 18,
              writableFieldCodes: [],
              writableFields: [],
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).advanceStageWorkflow(71, { version: 3 }),
    ).resolves.toMatchObject({
      id: 71,
      version: 4,
    });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/stage-workflow-records/71/advance");
    expect(await request.json()).toEqual({ version: 3 });
  });

  it("uses the record-scoped generated candidate route for stage approval selections", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            objectList: [{ actorId: 12, displayName: "王小明" }],
            totalNum: 1,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).getStageWorkflowAdvanceSelectionCandidates(71, "manager", {
        page: 1,
        size: 50,
      }),
    ).resolves.toEqual({ candidates: [{ actorId: 12, displayName: "王小明" }], total: 1 });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/stage-workflow-records/71/advance-options/manager/candidates?page=1&size=50",
    );
  });

  it("uses the record-scoped generated candidate route for specialized stage fields", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            objectList: [{ displayName: "王小明", id: 12, valueType: "ACTOR_ID" }],
            totalNum: 1,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).getStageWorkflowFieldCandidates(71, "owner", { page: 1, size: 50 }),
    ).resolves.toEqual({
      candidates: [{ displayName: "王小明", id: 12, valueType: "ACTOR_ID" }],
      total: 1,
    });

    expect(new Request(fetch.mock.calls[0]?.[0] as Request).url).toBe(
      "http://localhost/api/v1/stage-workflow-records/71/writable-fields/owner/candidates?page=1&size=50",
    );
  });

  it("uploads a stage FILE only through its record-scoped draft, intent, and confirmed status", async () => {
    const observed: {
      body: unknown;
      credentials: RequestCredentials;
      headers: Headers;
      method: string;
      url: string;
    }[] = [];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async (input, init) => {
        const request = new Request(input, init);
        observed.push({
          body:
            request.method === "POST" &&
            request.headers.get("content-type")?.includes("application/json")
              ? await request.clone().json()
              : undefined,
          credentials: request.credentials,
          headers: new Headers(request.headers),
          method: request.method,
          url: request.url,
        });
        if (
          request.url ===
          "http://localhost/api/v1/stage-workflow-records/71/writable-fields/evidence/file-drafts"
        ) {
          return new Response(
            JSON.stringify({
              draftId: 44,
              expiresAt: "2099-01-01T00:00:00Z",
              fieldCode: "evidence",
              version: 2,
              workflowRecordId: 71,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          request.url ===
          "http://localhost/api/v1/file-field-drafts/44/fields/evidence/upload-intents"
        ) {
          return new Response(
            JSON.stringify({
              draftId: 44,
              expiresAt: "2099-01-01T00:00:00Z",
              fieldCode: "evidence",
              fileId: 55,
              requiredHeaders: { "x-upload-token": "signed-token" },
              uploadMethod: "PUT",
              uploadUrl: "https://upload.example.test/file/55",
            }),
            { headers: { "Content-Type": "application/json" }, status: 201 },
          );
        }
        if (request.url === "https://upload.example.test/file/55") return new Response(null);
        if (
          request.url ===
          "http://localhost/api/v1/file-field-drafts/44/fields/evidence/files/55/upload-status"
        ) {
          return new Response(
            JSON.stringify({
              displayName: "合同凭证.pdf",
              fileId: 55,
              mediaType: "application/pdf",
              size: 8,
              status: "UPLOADED",
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).uploadStageWorkflowFiles(71, "evidence", [
        new File(["contents"], "合同凭证.pdf", { type: "application/pdf" }),
      ]),
    ).resolves.toMatchObject({
      draft: { draftId: 44, fieldCode: "evidence", workflowRecordId: 71 },
      files: [{ fileId: 55, status: "UPLOADED" }],
    });

    expect(observed.map((request) => request.url)).toEqual([
      "http://localhost/api/v1/stage-workflow-records/71/writable-fields/evidence/file-drafts",
      "http://localhost/api/v1/file-field-drafts/44/fields/evidence/upload-intents",
      "https://upload.example.test/file/55",
      "http://localhost/api/v1/file-field-drafts/44/fields/evidence/files/55/upload-status",
    ]);
    expect(observed[0]?.method).toBe("POST");
    expect(observed[1]?.method).toBe("POST");
    expect(observed[1]?.body).toEqual({
      declaredMediaType: "application/pdf",
      displayName: "合同凭证.pdf",
      expectedBytes: 8,
    });
    expect(observed[2]?.method).toBe("PUT");
    expect(observed[2]?.credentials).toBe("omit");
    expect(observed[2]?.headers.get("x-upload-token")).toBe("signed-token");
  });

  it("finishes a stage workflow only with the generated outcome request", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            record: {
              allowedActions: [],
              allowedOutcomes: [],
              allowedTaskCodes: [],
              currentStage: { name: "合同确认", order: 2, tasks: [] },
              id: 71,
              objectType: "CUSTOMER",
              recordId: 8,
              status: "FAILED",
              version: 4,
              workflowId: 18,
              writableFieldCodes: [],
              writableFields: [],
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      createApiClient(auth).finishStageWorkflow(71, {
        outcome: "FAILED",
        remark: "客户资料不完整",
        version: 3,
      }),
    ).resolves.toMatchObject({ id: 71, status: "FAILED", version: 4 });

    const request = new Request(fetch.mock.calls[0]?.[0] as Request);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost/api/v1/stage-workflow-records/71/outcome");
    expect(await request.json()).toEqual({
      outcome: "FAILED",
      remark: "客户资料不完整",
      version: 3,
    });
  });

  it("sends only selected record-scoped approvers and version for a stage advance", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            record: {
              allowedActions: [],
              allowedTaskCodes: [],
              currentStage: { name: "合同确认", order: 2, tasks: [] },
              id: 71,
              objectType: "CUSTOMER",
              recordId: 8,
              status: "AWAITING_APPROVAL",
              version: 4,
              workflowId: 18,
              writableFieldCodes: [],
              writableFields: [],
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).advanceStageWorkflow(71, {
      selectedApprovers: { manager: [12] },
      version: 3,
    });

    expect(await new Request(fetch.mock.calls[0]?.[0] as Request).json()).toEqual({
      selectedApprovers: { manager: [12] },
      version: 3,
    });
  });

  it("sends only current-stage task codes and version for a stage advance", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            record: {
              allowedActions: [],
              allowedTaskCodes: [],
              currentStage: { name: "合同确认", order: 2, tasks: [] },
              id: 71,
              objectType: "CUSTOMER",
              recordId: 8,
              status: "ACTIVE",
              version: 4,
              workflowId: 18,
              writableFieldCodes: [],
              writableFields: [],
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).advanceStageWorkflow(71, {
      completedTaskCodes: ["confirm-owner"],
      version: 3,
    });

    expect(await new Request(fetch.mock.calls[0]?.[0] as Request).json()).toEqual({
      completedTaskCodes: ["confirm-owner"],
      version: 3,
    });
  });

  it("sends only decoded field values and version for a stage advance", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            record: {
              allowedActions: [],
              allowedTaskCodes: [],
              currentStage: { name: "合同确认", order: 2, tasks: [] },
              id: 71,
              objectType: "CUSTOMER",
              recordId: 8,
              status: "ACTIVE",
              version: 4,
              workflowId: 18,
              writableFieldCodes: [],
              writableFields: [],
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await createApiClient(auth).advanceStageWorkflow(71, {
      fieldValues: { industry: ["technology"] },
      version: 3,
    });

    expect(await new Request(fetch.mock.calls[0]?.[0] as Request).json()).toEqual({
      fieldValues: { industry: ["technology"] },
      version: 3,
    });
  });

  it("uses the generated custom-report catalog and versioned definition contracts", async () => {
    const definition = {
      createdTime: "2026-07-29T09:00:00Z",
      filters: [],
      granularity: "DAY",
      id: 8,
      measures: [{ key: "COUNT", type: "COUNT" }],
      name: "本月赢单",
      objectType: "OPPORTUNITY",
      timeFieldCode: "outcome_time",
      updatedTime: "2026-07-29T09:00:00Z",
      version: 3,
    };
    const responses = [
      {
        dimensionFields: [],
        filterFields: [],
        measureTypes: ["COUNT", "SUM"],
        objectType: "OPPORTUNITY",
        sumFields: [],
        supportedObjectTypes: ["OPPORTUNITY"],
        timeFields: [],
      },
      definition,
      definition,
      definition,
      {},
      {
        columns: [],
        definitionId: 8,
        definitionVersion: 3,
        from: "2026-07-01",
        granularity: "DAY",
        objectType: "OPPORTUNITY",
        rows: [],
        to: "2026-07-29",
      },
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);
    const create = {
      filters: [],
      granularity: "DAY",
      measures: [{ type: "COUNT" }],
      name: "本月赢单",
      objectType: "OPPORTUNITY",
      timeFieldCode: "outcome_time",
    };

    await expect(client.getReportCatalog()).resolves.toMatchObject({
      objectType: "OPPORTUNITY",
      supportedObjectTypes: ["OPPORTUNITY"],
    });
    await expect(client.getReportDefinition(8)).resolves.toMatchObject({ id: 8, version: 3 });
    await client.createReportDefinition(create);
    await client.updateReportDefinition(8, { ...create, version: 3 });
    await client.deleteReportDefinition(8, 3);
    await client.runReportDefinition(8, { from: "2026-07-01", to: "2026-07-29" });

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toBe("http://localhost/api/v1/reports/catalog");
    expect(requests[1]?.url).toBe("http://localhost/api/v1/reports/definitions/8");
    expect(requests[2]?.method).toBe("POST");
    expect(await requests[2]?.json()).toEqual(create);
    expect(requests[3]?.method).toBe("PUT");
    expect(await requests[3]?.json()).toEqual({ ...create, version: 3 });
    expect(requests[4]?.url).toBe("http://localhost/api/v1/reports/definitions/8?version=3");
    expect(requests[5]?.method).toBe("POST");
    expect(await requests[5]?.json()).toEqual({ from: "2026-07-01", to: "2026-07-29" });
  });

  it("uses typed organization directory and membership-review contracts", async () => {
    const department = { active: true, id: 8, name: "华东销售部", status: "ACTIVE" };
    const responses = [
      [department],
      department,
      department,
      department,
      {},
      {},
      {
        objectList: [{ active: true, actorId: 9, displayName: "李莉", email: "li@example.test" }],
        pageNum: 1,
        pageSize: 20,
        totalNum: 1,
      },
      {
        objectList: [
          {
            applicantActorId: 9,
            createdTime: "2026-07-29T09:00:00Z",
            id: 12,
            status: "PENDING",
            targetTenantId: 1,
            updatedTime: "2026-07-29T09:00:00Z",
          },
        ],
        pageNum: 1,
        pageSize: 20,
        totalNum: 1,
      },
      {
        objectList: [
          {
            applicantActorId: 9,
            createdTime: "2026-07-29T09:00:00Z",
            id: 12,
            status: "PENDING",
            targetTenantId: 1,
            updatedTime: "2026-07-29T09:00:00Z",
          },
        ],
        pageNum: 1,
        pageSize: 20,
        totalNum: 1,
      },
      {
        applicantActorId: 9,
        createdTime: "2026-07-29T09:00:00Z",
        id: 12,
        status: "PENDING",
        targetTenantId: 1,
        updatedTime: "2026-07-29T09:00:00Z",
      },
      {},
      {},
      {},
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await client.getOrganizationDepartments();
    await client.createOrganizationDepartment({ name: "华东销售部" });
    await client.renameOrganizationDepartment(8, { name: "华东销售一部" });
    await client.moveOrganizationDepartment(8, { parentDepartmentId: 3 });
    await client.deactivateOrganizationDepartment(8);
    await client.deleteOrganizationDepartment(8);
    await client.getOrganizationMembers({ keyword: "李", page: 1, size: 20 });
    await client.getMembershipRequests({ page: 1, size: 20 });
    await client.getMyMembershipRequests({ page: 1, size: 20 });
    await client.submitMembershipRequest({ message: "申请加入", targetTenantId: 1 });
    await client.withdrawMembershipRequest(12);
    await client.approveMembershipRequest(12);
    await client.rejectMembershipRequest(12);

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toBe("http://localhost/api/v1/organization/departments");
    expect(await requests[1]?.json()).toEqual({ name: "华东销售部" });
    expect(await requests[2]?.json()).toEqual({ name: "华东销售一部" });
    expect(await requests[3]?.json()).toEqual({ parentDepartmentId: 3 });
    expect(requests[4]?.url).toBe("http://localhost/api/v1/organization/departments/8/deactivate");
    expect(requests[5]?.method).toBe("DELETE");
    expect(requests[6]?.url).toContain(
      "/api/v1/organization/members?keyword=%E6%9D%8E&page=1&size=20",
    );
    expect(requests[7]?.url).toBe(
      "http://localhost/api/v1/organization/membership-requests?page=1&size=20",
    );
    expect(requests[8]?.url).toBe(
      "http://localhost/api/v1/organization/membership-requests/mine?page=1&size=20",
    );
    expect(await requests[9]?.json()).toEqual({ message: "申请加入", targetTenantId: 1 });
    expect(requests[10]?.url).toBe(
      "http://localhost/api/v1/organization/membership-requests/12/withdraw",
    );
    expect(requests[11]?.url).toBe(
      "http://localhost/api/v1/organization/membership-requests/12/approve",
    );
    expect(requests[12]?.url).toBe(
      "http://localhost/api/v1/organization/membership-requests/12/reject",
    );
  });

  it("uses the typed tenant user-management contracts", async () => {
    const user = {
      active: true,
      createdTime: "2026-07-30T00:00:00Z",
      email: "alice@example.test",
      id: 12,
      maskedPhoneNumber: null,
      realName: "Alice",
      status: "ACTIVE",
      statusName: "Active",
      updatedTime: "2026-07-30T00:00:00Z",
      username: "alice",
    };
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({ objectList: [user], pageNum: 1, pageSize: 20, totalNum: 1 }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await client.getUsers({ page: 1, size: 20, status: "ACTIVE", username: "alice" });
    await client.createUser({
      email: "alice@example.test",
      password: "correct-password",
      username: "alice",
    });
    await client.updateUserStatus(12, "INACTIVE");
    await client.deleteUser(12);

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toBe(
      "http://localhost/api/v1/users?page=1&size=20&status=ACTIVE&username=alice",
    );
    expect(requests[1]?.method).toBe("POST");
    await expect(requests[1]?.json()).resolves.toEqual({
      email: "alice@example.test",
      password: "correct-password",
      username: "alice",
    });
    expect(requests[2]?.url).toBe("http://localhost/api/v1/users/12/status?status=INACTIVE");
    expect(requests[3]?.method).toBe("DELETE");
    expect(requests[3]?.url).toBe("http://localhost/api/v1/users/12");
  });

  it("uses typed tenant role management contracts", async () => {
    const role = {
      createdTime: "2026-07-29T09:00:00Z",
      grants: [{ authorityCode: "customers:read" }],
      id: 5,
      name: "客户只读",
      status: "ACTIVE",
      updatedTime: "2026-07-29T09:00:00Z",
      version: 2,
    };
    const responses = [
      [{ code: "customers:read", displayName: "读取客户", supportsDataScope: true }],
      { objectList: [role], pageNum: 1, pageSize: 20, totalNum: 1 },
      role,
      role,
      role,
      role,
      {},
      {
        objectList: [{ actorId: 9, createdTime: "2026-07-29T09:00:00Z", roleId: 5 }],
        pageNum: 1,
        pageSize: 20,
        totalNum: 1,
      },
      {},
      {},
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await client.getAuthorizationCapabilities();
    await client.getTenantRoles({ keyword: "客户", page: 1, size: 20 });
    await client.createTenantRole({
      grants: [{ authorityCode: "customers:read" }],
      name: "客户只读",
    });
    await client.updateTenantRole(5, { name: "客户只读", status: "ACTIVE", version: 2 });
    await client.copyTenantRole(5, { name: "客户只读副本" });
    await client.replaceTenantRoleGrants(5, {
      grants: [{ authorityCode: "customers:read" }],
      version: 2,
    });
    await client.deleteTenantRole(5, 2);
    await client.getTenantRoleAssignments(5, { page: 1, size: 20 });
    await client.assignTenantRole(5, { actorIds: [9] });
    await client.removeTenantRoleAssignment(5, 9);

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toBe("http://localhost/api/v1/authorization/capabilities");
    expect(requests[1]?.url).toContain(
      "/api/v1/authorization/roles?keyword=%E5%AE%A2%E6%88%B7&page=1&size=20",
    );
    expect(await requests[2]?.json()).toEqual({
      grants: [{ authorityCode: "customers:read" }],
      name: "客户只读",
    });
    expect(await requests[3]?.json()).toEqual({ name: "客户只读", status: "ACTIVE", version: 2 });
    expect(requests[4]?.url).toBe("http://localhost/api/v1/authorization/roles/5/copy");
    expect(await requests[4]?.json()).toEqual({ name: "客户只读副本" });
    expect(await requests[5]?.json()).toEqual({
      grants: [{ authorityCode: "customers:read" }],
      version: 2,
    });
    expect(requests[6]?.url).toBe("http://localhost/api/v1/authorization/roles/5?version=2");
    expect(requests[7]?.url).toBe(
      "http://localhost/api/v1/authorization/roles/5/assignments?page=1&size=20",
    );
    expect(await requests[8]?.json()).toEqual({ actorIds: [9] });
    expect(requests[9]?.url).toBe("http://localhost/api/v1/authorization/roles/5/assignments/9");
  });

  it("uses named enterprise-data contracts for governed lookup and adoption", async () => {
    const observation = {
      primaryIdentifier: {
        canonicalValue: "0000SYNTHETICFIXTU42",
        identityScope: "GLOBAL_LEI_SYSTEM",
        registryScheme: "LEI",
      },
      registeredName: "Synthetic Registry Labs Ltd",
      usageMode: "ADOPT_SELECTED_FACTS",
    };
    const responses = [
      {
        identifierTypes: [],
        legalJurisdictions: ["GB"],
        maxCandidates: 5,
        queryModes: ["NAME"],
        ready: true,
        usageMode: "ADOPT_SELECTED_FACTS",
      },
      [observation],
      observation,
      {
        diffs: [{ changed: true, fact: "REGISTERED_NAME", targetLocator: "field:name" }],
        observation,
        previewReference: "preview-reference",
      },
      { customerId: 9, customerVersion: 4 },
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await client.getEnterpriseDataCapabilities();
    await client.searchEnterpriseData({
      legalJurisdiction: "GB",
      registeredName: "Synthetic Registry",
    });
    await client.lookupEnterpriseData({
      identityScope: "GLOBAL_LEI_SYSTEM",
      registryScheme: "LEI",
      value: "0000SYNTHETICFIXTU42",
    });
    await client.previewEnterpriseDataAdoption({
      addressSlotKey: "registered",
      customerId: 9,
      customerVersion: 3,
      identityScope: "GLOBAL_LEI_SYSTEM",
      registryScheme: "LEI",
      value: "0000SYNTHETICFIXTU42",
    });
    await client.adoptEnterpriseData({
      customerVersion: 3,
      facts: ["REGISTERED_NAME"],
      identities: [{ identityScope: "GLOBAL_LEI_SYSTEM", registryScheme: "LEI" }],
      previewReference: "preview-reference",
    });

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toBe("http://localhost/api/v1/enterprise-data/capabilities");
    expect(requests[1]?.url).toBe("http://localhost/api/v1/enterprise-data/search");
    expect(await requests[1]?.json()).toEqual({
      legalJurisdiction: "GB",
      registeredName: "Synthetic Registry",
    });
    expect(requests[2]?.url).toBe("http://localhost/api/v1/enterprise-data/lookup");
    expect(await requests[2]?.json()).toEqual({
      identityScope: "GLOBAL_LEI_SYSTEM",
      registryScheme: "LEI",
      value: "0000SYNTHETICFIXTU42",
    });
    expect(requests[3]?.url).toBe("http://localhost/api/v1/enterprise-data/adoption-preview");
    expect(await requests[3]?.json()).toMatchObject({
      addressSlotKey: "registered",
      customerId: 9,
      customerVersion: 3,
    });
    expect(requests[4]?.url).toBe("http://localhost/api/v1/enterprise-data/adopt");
    expect(await requests[4]?.json()).toEqual({
      customerVersion: 3,
      facts: ["REGISTERED_NAME"],
      identities: [{ identityScope: "GLOBAL_LEI_SYSTEM", registryScheme: "LEI" }],
      previewReference: "preview-reference",
    });
  });

  it("uses typed field customization contracts", async () => {
    const field = {
      builtin: false,
      code: "cf_industry",
      createdTime: "2026-07-29T09:00:00Z",
      displayName: "行业",
      displayOrder: 10,
      fieldType: "SELECT",
      filterOperators: [{ code: "EQ", maximumValueCount: 1, minimumValueCount: 1 }],
      id: 9,
      options: [{ label: "软件", order: 0, value: "software" }],
      required: false,
      searchable: true,
      status: "ACTIVE",
      unique: false,
      updatedTime: "2026-07-29T09:00:00Z",
      version: 2,
    };
    const layout = {
      columnWidths: {},
      hiddenCodes: [],
      objectType: "CUSTOMER",
      orderedCodes: ["cf_industry"],
      pinnedCodes: [],
      version: null,
    };
    const policy = {
      accesses: [
        {
          accessLevel: "READ",
          displayName: "行业",
          fieldCode: "cf_industry",
          fieldId: 9,
          maskType: "PARTIAL",
        },
      ],
      objectType: "CUSTOMER",
      roleId: 5,
      version: null,
    };
    const responses = [
      [{ code: "CUSTOMER", displayName: "客户" }],
      [field],
      field,
      field,
      {},
      layout,
      layout,
      policy,
      policy,
    ];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await client.getCustomizableBusinessObjects();
    await client.listFieldDefinitions("CUSTOMER", true);
    await client.createFieldDefinition("CUSTOMER", { displayName: "行业", fieldType: "SELECT" });
    await client.updateFieldDefinition("CUSTOMER", 9, { displayName: "行业", version: 2 });
    await client.deactivateFieldDefinition("CUSTOMER", 9, 2);
    await client.getFieldLayoutDefinition("CUSTOMER");
    await client.updateFieldLayoutDefinition("CUSTOMER", {
      hiddenCodes: [],
      orderedCodes: ["cf_industry"],
      pinnedCodes: [],
    });
    await client.getRoleFieldPolicy(5, "CUSTOMER");
    await client.replaceRoleFieldPolicy(5, "CUSTOMER", {
      accesses: [{ accessLevel: "READ", fieldCode: "cf_industry", maskType: "PARTIAL" }],
    });

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toBe("http://localhost/api/v1/fields/objects");
    expect(requests[1]?.url).toBe(
      "http://localhost/api/v1/fields/objects/CUSTOMER?includeInactive=true",
    );
    expect(await requests[2]?.json()).toEqual({ displayName: "行业", fieldType: "SELECT" });
    expect(await requests[3]?.json()).toEqual({ displayName: "行业", version: 2 });
    expect(requests[4]?.url).toBe("http://localhost/api/v1/fields/objects/CUSTOMER/9?version=2");
    expect(requests[5]?.url).toBe("http://localhost/api/v1/fields/objects/CUSTOMER/layout");
    expect(await requests[6]?.json()).toEqual({
      hiddenCodes: [],
      orderedCodes: ["cf_industry"],
      pinnedCodes: [],
    });
    expect(requests[7]?.url).toBe("http://localhost/api/v1/fields/roles/5/objects/CUSTOMER/access");
    expect(await requests[8]?.json()).toEqual({
      accesses: [{ accessLevel: "READ", fieldCode: "cf_industry", maskType: "PARTIAL" }],
    });
  });

  it("uses typed saved-view contracts", async () => {
    const savedView = {
      conditions: [
        { exposed: true, fieldCode: "customer_name", operator: "CONTAINS", values: ["Atom"] },
      ],
      createdTime: "2026-07-30T12:00:00Z",
      defaultView: false,
      hidden: false,
      id: 7,
      name: "重点客户",
      objectType: "CUSTOMER",
      sortOrder: 0,
      updatedTime: "2026-07-30T12:00:00Z",
      version: 3,
    };
    const responses = [[savedView], savedView, savedView, savedView, null];
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await client.listSavedViews("CUSTOMER", true);
    await client.createSavedView({
      conditions: [
        { exposed: false, fieldCode: "customer_name", operator: "CONTAINS", values: ["Atom"] },
      ],
      name: "重点客户",
      objectType: "CUSTOMER",
    });
    await client.updateSavedView(7, {
      conditions: [],
      name: "全部客户",
      version: 3,
    });
    await client.setDefaultSavedView(7, 3);
    await client.deleteSavedView(7, 3);

    const requests = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(requests[0]?.url).toBe(
      "http://localhost/api/v1/saved-views?includeHidden=true&objectType=CUSTOMER",
    );
    expect(await requests[1]?.json()).toEqual({
      conditions: [
        { exposed: false, fieldCode: "customer_name", operator: "CONTAINS", values: ["Atom"] },
      ],
      name: "重点客户",
      objectType: "CUSTOMER",
    });
    expect(await requests[2]?.json()).toEqual({
      conditions: [],
      name: "全部客户",
      version: 3,
    });
    expect(requests[3]?.url).toBe("http://localhost/api/v1/saved-views/7/default?version=3");
    expect(requests[4]?.url).toBe("http://localhost/api/v1/saved-views/7?version=3");
  });

  it("uses a date-bound worklist and sends only server-issued acknowledgement fingerprints", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                dueTime: "2026-08-10T09:00:00",
                kind: "FOLLOW_UP",
                sourceId: 8,
                sourceVersion: 3,
                subjectId: 12,
                subjectType: "CUSTOMER",
                summary: "确认本周回访",
              },
            ],
            nextCursor: null,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getWorklist({ date: "2026-08-10", size: 50 })).resolves.toMatchObject({
      nextCursor: null,
    });
    await client.acknowledgeWorklist({
      date: "2026-08-10",
      items: [
        {
          dueTime: "2026-08-10T09:00:00",
          kind: "FOLLOW_UP",
          sourceId: 8,
          sourceVersion: 3,
        },
      ],
    });

    const [queryRequest, acknowledgementRequest] = fetch.mock.calls.map(
      ([input]) => new Request(input as RequestInfo),
    );
    expect(queryRequest?.url).toBe("http://localhost/api/v1/worklist?date=2026-08-10&size=50");
    expect(acknowledgementRequest?.method).toBe("POST");
    expect(acknowledgementRequest?.url).toBe("http://localhost/api/v1/worklist/acknowledgements");
    await expect(acknowledgementRequest?.json()).resolves.toEqual({
      date: "2026-08-10",
      items: [
        {
          dueTime: "2026-08-10T09:00:00",
          kind: "FOLLOW_UP",
          sourceId: 8,
          sourceVersion: 3,
        },
      ],
    });
  });

  it("summarizes the current server-filtered opportunity query without browser arithmetic", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ count: 3, estimatedAmount: 1250.5 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(
      client.getOpportunitySummary({ keyword: "Atom", outcome: "OPEN", page: 3, size: 15 }),
    ).resolves.toEqual({ count: 3, estimatedAmount: 1250.5 });

    const [request] = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(request?.url).toBe("http://localhost/api/v1/opportunities/summary");
    await expect(request?.json()).resolves.toEqual({
      keyword: "Atom",
      outcome: "OPEN",
      page: 3,
      size: 15,
    });
  });

  it("reads the server-calculated contract financial summary with the active query", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            count: 3,
            outstandingAmount: 200,
            receivedAmount: 50,
            totalAmount: 250,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(
      client.getContractSummary({
        customerId: 7,
        keyword: "年度续约",
        page: 2,
        size: 20,
        status: "ACTIVE",
      }),
    ).resolves.toEqual({
      count: 3,
      outstandingAmount: 200,
      receivedAmount: 50,
      totalAmount: 250,
    });

    const [request] = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(request?.url).toBe("http://localhost/api/v1/contracts/summary");
    await expect(request?.json()).resolves.toEqual({
      customerId: 7,
      keyword: "年度续约",
      page: 2,
      size: 20,
      status: "ACTIVE",
    });
  });

  it("reads the server-calculated receivable amount summary with the active query", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ count: 3, totalAmount: 250 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(
      client.getReceivableSummary({
        customerId: 7,
        keyword: "到账",
        page: 2,
        size: 20,
      }),
    ).resolves.toEqual({ count: 3, totalAmount: 250 });

    const [request] = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(request?.url).toBe("http://localhost/api/v1/receivables/summary");
    await expect(request?.json()).resolves.toEqual({
      customerId: 7,
      keyword: "到账",
      page: 2,
      size: 20,
    });
  });

  it("reads the server-calculated receivable-plan amounts with the active query", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            count: 3,
            plannedAmount: 250,
            receivedAmount: 100,
            remainingAmount: 150,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(
      client.getReceivablePlanSummary({
        customerId: 7,
        keyword: "2",
        page: 2,
        size: 20,
      }),
    ).resolves.toEqual({
      count: 3,
      plannedAmount: 250,
      receivedAmount: 100,
      remainingAmount: 150,
    });

    const [request] = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(request?.url).toBe("http://localhost/api/v1/receivable-plans/summary");
    await expect(request?.json()).resolves.toEqual({
      customerId: 7,
      keyword: "2",
      page: 2,
      size: 20,
    });
  });

  it("reads only the caller's server-authorized pending approval count", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ count: 12 }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = createApiClient(auth);

    await expect(client.getApprovalPendingCount()).resolves.toBe(12);

    const [request] = fetch.mock.calls.map(([input]) => new Request(input as RequestInfo));
    expect(request?.url).toBe("http://localhost/api/v1/approvals/pending-count");
  });
});
