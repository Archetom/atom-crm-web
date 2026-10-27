import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPublicMarketingApiClient } from "./public-api-client";

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

describe("public marketing API client", () => {
  it("uses capability-only public requests and omits authentication", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    fetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            fields: [],
            publicId: "public-form",
            submitButtonText: "提交",
            title: "咨询我们",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accepted: true, idempotencyKey: "once", submissionId: 7 }), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const client = createPublicMarketingApiClient();

    await client.getForm("public-form");
    await client.submit(
      "public-form",
      { idempotencyKey: "once", values: { lead_name: ["张三"] } },
      "one-time-capability",
    );

    const [getRequest, submitRequest] = fetch.mock.calls.map(
      ([input]) => new Request(input as RequestInfo),
    );
    expect(getRequest?.url).toBe("http://localhost/api/v1/open/marketing-forms/public-form");
    expect(getRequest?.headers.get("Authorization")).toBeNull();
    expect(getRequest?.credentials).toBe("omit");
    expect(submitRequest?.url).toBe("http://localhost/api/v1/open/marketing-forms/public-form");
    expect(submitRequest?.headers.get("Authorization")).toBeNull();
    expect(submitRequest?.headers.get("X-Public-Upload-Capability")).toBe("one-time-capability");
    expect(submitRequest?.credentials).toBe("omit");
    await expect(submitRequest?.json()).resolves.toEqual({
      idempotencyKey: "once",
      values: { lead_name: ["张三"] },
    });
  });
});
