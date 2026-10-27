import { recordOf } from "~/shared/utils/decode";

export type CustomFieldValues = Readonly<Record<string, readonly string[]>>;

/**
 * Keeps only the scalar values that the server has already made visible for
 * the current record and caller. This decoder never reconstructs hidden
 * fields from response data.
 */
export function decodeCustomFieldValues(value: unknown): CustomFieldValues {
  const source = recordOf(value);
  if (source === null) return {};

  return Object.fromEntries(
    Object.entries(source).flatMap(([code, values]) => {
      if (code.trim().length === 0 || !Array.isArray(values)) return [];
      return [[code, values.filter((item): item is string => typeof item === "string")]];
    }),
  );
}
