import type { components } from "~/api/generated/schema";

export type DashboardModule =
  components["schemas"]["DashboardPreferenceResponse"]["hiddenModules"][number];

export const dashboardModules = {
  customerContactReminder: "CUSTOMER_CONTACT_REMINDER",
} as const satisfies Record<string, DashboardModule>;

const calendarDate = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  if (!calendarDate.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

/** Only complete, calendar-valid ranges may be sent with a CUSTOM dashboard preference. */
export function hasOrderedDashboardDateRange(
  customStartDate: string | undefined,
  customEndDate: string | undefined,
): boolean {
  return (
    customStartDate !== undefined &&
    customEndDate !== undefined &&
    isCalendarDate(customStartDate) &&
    isCalendarDate(customEndDate) &&
    customStartDate <= customEndDate
  );
}

/** Replaces only one server-defined presentation module in a complete preference payload. */
export function withDashboardModuleVisibility(
  hiddenModules: readonly DashboardModule[] | undefined,
  module: DashboardModule,
  visible: boolean,
): DashboardModule[] {
  const current = hiddenModules ?? [];
  return visible
    ? current.filter((candidate) => candidate !== module)
    : [...new Set([...current, module])];
}
