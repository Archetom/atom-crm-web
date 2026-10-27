import { afterEach, describe, expect, it } from "vitest";

import { withBrowserSession } from "./browser-session";

afterEach(() => {
  document.cookie = "atom_crm_csrf=; Max-Age=0; Path=/";
});

describe("withBrowserSession", () => {
  it("adds the same-origin CSRF header only to unsafe browser requests", () => {
    document.cookie = "atom_crm_csrf=csrf-value; Path=/";

    const post = withBrowserSession({ headers: { Accept: "application/json" }, method: "POST" });
    const get = withBrowserSession({ method: "GET" });

    expect(post.credentials).toBe("same-origin");
    expect(new Headers(post.headers).get("X-Atom-CSRF")).toBe("csrf-value");
    expect(new Headers(post.headers).get("Accept")).toBe("application/json");
    expect(new Headers(get.headers).has("X-Atom-CSRF")).toBe(false);
  });
});
