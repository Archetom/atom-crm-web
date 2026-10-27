import { describe, expect, it } from "vitest";

import { translateTitleKey, zhCNMessages } from "./messages";

describe("translateTitleKey", () => {
  it("translates known NavigationCatalog keys", () => {
    expect(translateTitleKey("navigation.customers")).toBe("客户");
  });

  it("covers every navigation key the global create shortcuts depend on", () => {
    // These routes are gated on the server navigation tree exposing them, so their
    // menu entries must never fall back to a raw backend code.
    for (const key of [
      "navigation.contracts",
      "navigation.receivables",
      "navigation.invoices",
      "navigation.returnVisits",
    ] as const) {
      expect(zhCNMessages[key]).toBeTruthy();
    }
  });

  it("uses the caller's fallback for an unmapped key, as the app shell does", () => {
    // `responsive-app-layout` passes the backend `code` as the fallback, so this is the
    // branch that actually runs in the application.
    expect(translateTitleKey("navigation.notReleasedYet", "crm.not-released-yet")).toBe(
      "crm.not-released-yet",
    );
  });

  it("uses a safe default when the caller supplies no fallback", () => {
    expect(translateTitleKey("navigation.notReleasedYet")).toBe("未命名菜单");
  });
});
