export const dashboardKeys = {
  all: ["dashboard"] as const,
  overview: (identityKey: string) => [...dashboardKeys.all, "overview", identityKey] as const,
  preference: (identityKey: string) => [...dashboardKeys.all, "preference", identityKey] as const,
  performanceTargets: (identityKey: string, memberId: number, targetYear: number) =>
    [...dashboardKeys.all, "performance-targets", identityKey, memberId, targetYear] as const,
  departmentPerformanceTargets: (identityKey: string, departmentId: number, targetYear: number) =>
    [
      ...dashboardKeys.all,
      "department-performance-targets",
      identityKey,
      departmentId,
      targetYear,
    ] as const,
  reports: (identityKey: string) => [...dashboardKeys.all, "reports", identityKey] as const,
};
