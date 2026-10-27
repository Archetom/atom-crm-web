import { recordOf } from "~/shared/utils/decode";

export interface OpportunityContact {
  id: number;
  name: string;
  primary: boolean;
}

/**
 * Decodes the server-visible related-contact projection. This is not a
 * replacement baseline: hidden contacts may be intentionally absent.
 */
export function decodeOpportunityContacts(value: unknown): readonly OpportunityContact[] {
  const source = recordOf(value);
  if (source === null || !Array.isArray(source.objectList)) {
    throw new Error("商机联系人数据暂时不可用，请稍后重试。");
  }

  const known = new Set<number>();
  const contacts: OpportunityContact[] = [];
  for (const value of source.objectList) {
    const contact = recordOf(value);
    const id = contact?.id;
    const name = contact?.name;
    if (
      typeof id !== "number" ||
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof name !== "string" ||
      name.trim().length === 0 ||
      typeof contact?.primary !== "boolean" ||
      known.has(id)
    ) {
      throw new Error("商机联系人数据暂时不可用，请稍后重试。");
    }
    known.add(id);
    contacts.push({ id, name, primary: contact.primary });
  }

  return contacts;
}
