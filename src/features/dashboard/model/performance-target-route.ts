const minimumTargetYear = 2000;
const maximumTargetYear = 9999;

export interface PerformanceTargetRouteQuery {
  departmentId: number | null;
  memberId: number | null;
  targetScope: "MEMBER" | "DEPARTMENT";
  targetYear: number;
}

function positiveInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function validTargetYear(value: string | null, fallback: number): number {
  const parsed = positiveInteger(value);
  return parsed !== null && parsed >= minimumTargetYear && parsed <= maximumTargetYear
    ? parsed
    : fallback;
}

/** Keeps the selected subject, subject kind, and calendar year recoverable in the target-settings URL. */
export function performanceTargetRouteQueryFromSearchParams(
  searchParams: URLSearchParams,
  currentYear: number,
): PerformanceTargetRouteQuery {
  return {
    departmentId: positiveInteger(searchParams.get("departmentId")),
    memberId: positiveInteger(searchParams.get("memberId")),
    targetScope: searchParams.get("targetScope") === "DEPARTMENT" ? "DEPARTMENT" : "MEMBER",
    targetYear: validTargetYear(searchParams.get("targetYear"), currentYear),
  };
}

/** Preserves unrelated route state while changing one server-validated target query dimension. */
export function withPerformanceTargetRouteQuery(
  current: URLSearchParams,
  update: Partial<PerformanceTargetRouteQuery>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (update.departmentId !== undefined) {
    if (update.departmentId === null) next.delete("departmentId");
    else next.set("departmentId", String(update.departmentId));
  }
  if (update.memberId !== undefined) {
    if (update.memberId === null) next.delete("memberId");
    else next.set("memberId", String(update.memberId));
  }
  if (update.targetScope !== undefined) next.set("targetScope", update.targetScope);
  if (update.targetYear !== undefined) next.set("targetYear", String(update.targetYear));
  return next;
}
