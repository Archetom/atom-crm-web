function positiveIdentifier(value: string | null): number | null {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null;
  const identifier = Number(value);
  return Number.isSafeInteger(identifier) ? identifier : null;
}

export interface ContactCreateRouteContext {
  customerId: number | null;
  returnPath: string | null;
}

/**
 * Keep the optional customer context URL-recoverable, but accept only the
 * precise customer-detail path belonging to the same positive identifier.
 * The page still confirms that customer through the server before creation.
 */
export function contactCreateRouteContextFromSearch(search: string): ContactCreateRouteContext {
  const parameters = new URLSearchParams(search);
  const customerId = positiveIdentifier(parameters.get("customerId"));
  const customerPath = customerId === null ? null : `/crm/customers/${customerId}`;
  return {
    customerId,
    returnPath: parameters.get("returnTo") === customerPath ? customerPath : null,
  };
}
