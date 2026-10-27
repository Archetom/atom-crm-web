export const worklistKeys = {
  all: ["worklist"] as const,
  day: (identityKey: string, date: string) => ["worklist", identityKey, date] as const,
};
