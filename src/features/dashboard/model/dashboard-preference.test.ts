import { describe, expect, it } from "vitest";

import {
  dashboardModules,
  hasOrderedDashboardDateRange,
  withDashboardModuleVisibility,
} from "./dashboard-preference";

describe("hasOrderedDashboardDateRange", () => {
  it("accepts complete ordered calendar dates", () => {
    expect(hasOrderedDashboardDateRange("2026-08-01", "2026-08-10")).toBe(true);
    expect(hasOrderedDashboardDateRange("2026-08-10", "2026-08-10")).toBe(true);
  });

  it("rejects incomplete, invalid, and reverse ranges before a preference update", () => {
    expect(hasOrderedDashboardDateRange(undefined, "2026-08-10")).toBe(false);
    expect(hasOrderedDashboardDateRange("2026-02-29", "2026-03-01")).toBe(false);
    expect(hasOrderedDashboardDateRange("2026-08-10", "2026-08-01")).toBe(false);
  });
});

describe("withDashboardModuleVisibility", () => {
  it("only changes the named server-defined module", () => {
    expect(
      withDashboardModuleVisibility([], dashboardModules.customerContactReminder, false),
    ).toEqual(["CUSTOMER_CONTACT_REMINDER"]);
    expect(
      withDashboardModuleVisibility(
        ["CUSTOMER_CONTACT_REMINDER"],
        dashboardModules.customerContactReminder,
        true,
      ),
    ).toEqual([]);
  });
});
