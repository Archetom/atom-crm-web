export const workTaskSeriesOccurrenceKeys = {
  all: ["work-task-series-occurrences"] as const,
  list: (
    identityKey: string,
    params: { readonly page: number; readonly seriesId: number; readonly size: number },
  ) => ["work-task-series-occurrences", identityKey, params] as const,
};
