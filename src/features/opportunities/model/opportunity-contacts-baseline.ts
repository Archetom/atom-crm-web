import type { OpportunityContact } from "./opportunity-contact";
import { recordOf } from "~/shared/utils/decode";

export interface OpportunityContactsBaseline {
  id: number;
  version: number;
  editable: boolean;
  customerId: number | null;
  contacts: readonly OpportunityContact[];
}

/**
 * A non-editable baseline deliberately contains no relationship values. The
 * browser must not turn a partial or field-masked projection into a replace
 * request that could remove contacts it was not allowed to see.
 */
export function decodeOpportunityContactsBaseline(value: unknown): OpportunityContactsBaseline {
  const source = recordOf(value);
  const id = source?.id;
  const version = source?.version;
  const editable = source?.editable;
  if (
    source === null ||
    typeof id !== "number" ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    typeof editable !== "boolean"
  ) {
    throw new Error("商机联系人完整基线暂时不可用，请稍后重试。");
  }

  if (!editable) {
    if (source.customerId !== undefined || source.contacts !== undefined) {
      throw new Error("商机联系人完整基线暂时不可用，请稍后重试。");
    }
    return { contacts: [], customerId: null, editable, id, version };
  }

  const customerId = source.customerId;
  const rawContacts = source.contacts;
  if (
    typeof customerId !== "number" ||
    !Number.isSafeInteger(customerId) ||
    customerId <= 0 ||
    !Array.isArray(rawContacts)
  ) {
    throw new Error("商机联系人完整基线暂时不可用，请稍后重试。");
  }

  const contactIds = new Set<number>();
  let primaryCount = 0;
  const contacts = rawContacts.map((value) => {
    const contact = recordOf(value);
    const contactId = contact?.id;
    const name = contact?.name;
    const primary = contact?.primary;
    if (
      contact === null ||
      typeof contactId !== "number" ||
      !Number.isSafeInteger(contactId) ||
      contactId <= 0 ||
      typeof name !== "string" ||
      name.trim().length === 0 ||
      typeof primary !== "boolean" ||
      contactIds.has(contactId)
    ) {
      throw new Error("商机联系人完整基线暂时不可用，请稍后重试。");
    }
    contactIds.add(contactId);
    if (primary) primaryCount += 1;
    if (primaryCount > 1) {
      throw new Error("商机联系人完整基线暂时不可用，请稍后重试。");
    }
    return { id: contactId, name, primary };
  });

  return { contacts, customerId, editable, id, version };
}
