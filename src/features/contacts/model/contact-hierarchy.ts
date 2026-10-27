import { recordOf } from "~/shared/utils/decode";

export interface ContactHierarchyNode {
  id: number;
  name: string;
  parentContactId: number | null;
}

export interface ContactHierarchy {
  requestedContactId: number;
  contacts: readonly ContactHierarchyNode[];
}

function identifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalIdentifier(value: unknown): number | null {
  return value === null || value === undefined ? null : identifier(value);
}

/** Decodes only the server-visible nodes of a contact hierarchy. */
export function toContactHierarchy(
  value: unknown,
  expectedContactId: number,
): ContactHierarchy | null {
  const source = recordOf(value);
  if (source === null || identifier(source.requestedContactId) !== expectedContactId) return null;
  if (!Array.isArray(source.contacts)) return null;

  const identifiers = new Set<number>();
  const contacts: ContactHierarchyNode[] = [];
  for (const value of source.contacts) {
    const contact = recordOf(value);
    if (contact === null) return null;

    const id = identifier(contact.id);
    const name = contact.name;
    const parentContactId = optionalIdentifier(contact.parentContactId);
    if (
      id === null ||
      typeof name !== "string" ||
      name.length === 0 ||
      (contact.parentContactId !== null &&
        contact.parentContactId !== undefined &&
        parentContactId === null) ||
      identifiers.has(id)
    ) {
      return null;
    }

    identifiers.add(id);
    contacts.push({ id, name, parentContactId });
  }

  if (!identifiers.has(expectedContactId)) return null;
  return { requestedContactId: expectedContactId, contacts };
}

/** Finds descendants only inside the server-returned visible hierarchy. */
export function visibleDescendantIds(hierarchy: ContactHierarchy): ReadonlySet<number> {
  const childrenByParent = new Map<number, number[]>();
  for (const contact of hierarchy.contacts) {
    if (contact.parentContactId === null) continue;
    const children = childrenByParent.get(contact.parentContactId) ?? [];
    children.push(contact.id);
    childrenByParent.set(contact.parentContactId, children);
  }

  const descendants = new Set<number>();
  const pending = [...(childrenByParent.get(hierarchy.requestedContactId) ?? [])];
  while (pending.length > 0) {
    const contactId = pending.pop();
    if (contactId === undefined || descendants.has(contactId)) continue;
    descendants.add(contactId);
    pending.push(...(childrenByParent.get(contactId) ?? []));
  }
  return descendants;
}
