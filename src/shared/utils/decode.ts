/**
 * Shared runtime guards for decoding server payloads.
 *
 * Every runtime projection in the application narrows an `unknown` response before it
 * reaches a component. These primitives are the vocabulary those decoders share; they
 * were previously re-declared in each decoder, which let two same-named copies drift
 * apart on how they treat a blank string.
 */

/** Narrows to a plain object. Arrays are rejected so callers cannot index into one. */
export function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** A server identity: a safe positive integer, never `0` and never fractional. */
export function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** A required string: whitespace-only is treated as absent. */
export function nonBlankString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * An optional display string where the server uses `""` to mean "no value".
 * Prefer this: it renders through the shared em-dash fallback instead of a blank cell.
 */
export function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * An optional display string where `""` is a meaningful server value distinct from
 * absent. Only use this when the projection genuinely needs that distinction.
 */
export function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** A string that parses as a date-time. The original server text is returned unchanged. */
export function isoDateTime(value: unknown): string | null {
  const parsed = nonBlankString(value);
  return parsed === null || Number.isNaN(Date.parse(parsed)) ? null : parsed;
}
