import { describe, expect, it } from "vitest";

import {
  returnVisitDetailPathFromEditSearch,
  returnVisitEditPath,
  returnVisitCreatePath,
  returnVisitListPathFromCreateSearch,
  selectedReturnVisitIdFromSearch,
} from "./return-visit-list-route";

describe("return-visit global creation route", () => {
  it("preserves global-list query state when opening creation", () => {
    expect(returnVisitCreatePath("?keyword=renewal&page=3&sort=visit-time-asc")).toBe(
      "/crm/return-visits/new?returnTo=%3Fkeyword%3Drenewal%26page%3D3%26sort%3Dvisit-time-asc",
    );
  });

  it("returns only to the return-visit list and keeps a safe query string", () => {
    expect(
      returnVisitListPathFromCreateSearch(
        "returnTo=%3Fkeyword%3Drenewal%26page%3D3%26sort%3Dvisit-time-asc",
      ),
    ).toBe("/crm/return-visits?keyword=renewal&page=3&sort=visit-time-asc");
    expect(returnVisitListPathFromCreateSearch("returnTo=%2Fcrm%2Fcustomers")).toBe(
      "/crm/return-visits",
    );
    expect(returnVisitListPathFromCreateSearch("returnTo=%3Fkeyword%3Done%23other")).toBe(
      "/crm/return-visits",
    );
  });
});

describe("return-visit global detail route", () => {
  it("accepts only a positive safe selected ID", () => {
    expect(selectedReturnVisitIdFromSearch("returnVisitId=42")).toBe(42);
    expect(selectedReturnVisitIdFromSearch("returnVisitId=0")).toBeNull();
    expect(selectedReturnVisitIdFromSearch("returnVisitId=1.5")).toBeNull();
    expect(selectedReturnVisitIdFromSearch("returnVisitId=999999999999999999999")).toBeNull();
  });

  it("preserves the list selection through editing and restores the drawer", () => {
    expect(returnVisitEditPath(7, 42, "?keyword=renewal&page=3")).toBe(
      "/crm/customers/7/return-visits/42/edit?returnTo=%3Fkeyword%3Drenewal%26page%3D3",
    );
    expect(
      returnVisitDetailPathFromEditSearch("returnTo=%3Fkeyword%3Drenewal%26page%3D3", 7, 42),
    ).toBe("/crm/return-visits?keyword=renewal&page=3&returnVisitId=42");
  });

  it("falls back to the customer detail only without a safe saved list query", () => {
    expect(returnVisitDetailPathFromEditSearch("returnTo=%2Fcrm%2Fcustomers", 7, 42)).toBe(
      "/crm/customers/7/return-visits/42",
    );
    expect(returnVisitDetailPathFromEditSearch("", null, 42)).toBe("/crm/return-visits");
  });
});
