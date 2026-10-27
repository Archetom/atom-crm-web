import type { components } from "~/api/generated/schema";

export type EntityQueryValue =
  boolean | number | string | null | undefined | components["schemas"]["FilterConditionRequest"][];
type QueryParameters = Readonly<Record<string, EntityQueryValue>>;

function compactQuery(
  query: QueryParameters,
): Record<string, Exclude<EntityQueryValue, undefined>> {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right)),
  ) as Record<string, Exclude<EntityQueryValue, undefined>>;
}

export function createEntityQueryKeys(scope: string) {
  const all = [scope] as const;

  return {
    all,
    lists: (identityKey: string) => [...all, "list", identityKey] as const,
    list: (identityKey: string, query: QueryParameters) =>
      [...all, "list", identityKey, compactQuery(query)] as const,
    detail: (identityKey: string, id: number) => [...all, "detail", identityKey, id] as const,
  };
}
