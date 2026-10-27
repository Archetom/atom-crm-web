import {
  toContactListItem,
  type ContactListItem,
} from "~/features/contacts/model/contact-list-item";
import { recordOf } from "~/shared/utils/decode";

export interface ContactPoolContactListItem extends ContactListItem {
  version: number;
}

/**
 * Pool actions need the server-issued optimistic-lock version, so this narrow
 * projection intentionally differs from the global contact-list projection.
 */
export function toContactPoolContactListItem(value: unknown): ContactPoolContactListItem | null {
  const contact = toContactListItem(value);
  const source = recordOf(value);
  const version = source?.version;
  if (
    contact === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    return null;
  }

  return { ...contact, version };
}
