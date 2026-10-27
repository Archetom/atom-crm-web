import {
  decodeControlledFileFields,
  type ControlledFileField,
} from "~/components/controlled-file-field/model";

import { toReturnVisitListItem, type ReturnVisitListItem } from "./return-visit-list-item";
import { recordOf } from "~/shared/utils/decode";

export interface ReturnVisitDetail extends ReturnVisitListItem {
  customerId: number;
  fileFields?: readonly ControlledFileField[];
}

/**
 * A customer-context detail page requires the unmasked customer relation to keep
 * the route from displaying a return visit belonging to another customer.
 */
export function toReturnVisitDetail(value: unknown): ReturnVisitDetail | null {
  const source = recordOf(value);
  if (source === null) return null;

  const returnVisit = toReturnVisitListItem(value);
  if (returnVisit === null) return null;
  const { customerId } = returnVisit;
  if (customerId === null) return null;

  return { ...returnVisit, customerId, fileFields: decodeControlledFileFields(source.fileFields) };
}
