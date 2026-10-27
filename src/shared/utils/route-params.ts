/**
 * Parses a record identifier out of a route parameter.
 *
 * A route parameter is untrusted browser input, so this accepts only the canonical
 * decimal form of a positive integer: no leading zeros, no sign, no whitespace, no
 * exponent. Anything else yields `null` and the caller renders the not-found state
 * rather than issuing a request with a malformed identity.
 */
export function parseRouteId(value: string | undefined): number | null {
  if (value === undefined || !/^[1-9]\d*$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Parses a positive integer a user typed into a field.
 *
 * Unlike a route parameter this tolerates surrounding whitespace, but it still refuses
 * anything the round trip through `String` would not reproduce — so `1e3`, `01` and
 * `1.0` are all rejected rather than silently coerced to a different identity.
 */
export function parsePositiveIntegerInput(value: string): number | undefined {
  const normalized = value.trim();
  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && String(parsed) === normalized
    ? parsed
    : undefined;
}
