import type { components } from "~/api/generated/schema";

export interface PersonalInvoiceProfileCreateValues {
  customerId: number;
  title: string;
}

export interface PersonalInvoiceProfileTitleUpdateValues {
  title: string;
  version: number;
}

/**
 * The initial UI deliberately supports only individual titles. Organization
 * details are handled in a later, separately reviewed sensitive-field flow.
 */
export function toPersonalInvoiceProfileCreateRequest(
  values: PersonalInvoiceProfileCreateValues,
): components["schemas"]["InvoiceProfileRequest"] {
  return {
    customerId: values.customerId,
    title: values.title,
    titleType: "INDIVIDUAL",
  };
}

/**
 * Only the user-confirmed individual title is changed. Sensitive organization
 * and profile fields never enter this narrow update request.
 */
export function toPersonalInvoiceProfileTitleUpdateRequest(
  values: PersonalInvoiceProfileTitleUpdateValues,
): components["schemas"]["InvoiceProfileUpdateRequest"] {
  return {
    title: values.title,
    version: values.version,
  };
}
