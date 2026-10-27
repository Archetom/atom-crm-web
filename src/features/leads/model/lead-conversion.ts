export interface LeadConversion {
  leadId: number;
  customerId: number;
  contactId: number;
  leadVersion: number;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Keep only the conversion identifiers explicitly returned by the server. */
export function toLeadConversion(value: unknown, requestedLeadId: number): LeadConversion | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const leadId = positiveIdentifier(source.leadId);
  const customerId = positiveIdentifier(source.customerId);
  const contactId = positiveIdentifier(source.contactId);
  const leadVersion = source.leadVersion;
  if (
    leadId === null ||
    leadId !== requestedLeadId ||
    customerId === null ||
    contactId === null ||
    typeof leadVersion !== "number" ||
    !Number.isSafeInteger(leadVersion) ||
    leadVersion < 0
  ) {
    return null;
  }

  return { leadId, customerId, contactId, leadVersion };
}
