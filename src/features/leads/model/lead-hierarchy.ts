import { recordOf } from "~/shared/utils/decode";

export interface LeadHierarchyNode {
  id: number;
  name: string;
  parentLeadId: number | null;
}

export interface LeadHierarchy {
  requestedLeadId: number;
  leads: readonly LeadHierarchyNode[];
}

function identifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalIdentifier(value: unknown): number | null {
  return value === null || value === undefined ? null : identifier(value);
}

/** Decodes only the server-visible nodes of a lead hierarchy. */
export function toLeadHierarchy(value: unknown, expectedLeadId: number): LeadHierarchy | null {
  const source = recordOf(value);
  if (source === null || identifier(source.requestedLeadId) !== expectedLeadId) return null;
  if (!Array.isArray(source.leads)) return null;

  const identifiers = new Set<number>();
  const leads: LeadHierarchyNode[] = [];
  for (const value of source.leads) {
    const lead = recordOf(value);
    if (lead === null) return null;

    const id = identifier(lead.id);
    const name = lead.name;
    const parentLeadId = optionalIdentifier(lead.parentLeadId);
    if (
      id === null ||
      typeof name !== "string" ||
      name.length === 0 ||
      (lead.parentLeadId !== null && lead.parentLeadId !== undefined && parentLeadId === null) ||
      identifiers.has(id)
    ) {
      return null;
    }

    identifiers.add(id);
    leads.push({ id, name, parentLeadId });
  }

  if (!identifiers.has(expectedLeadId)) return null;
  return { requestedLeadId: expectedLeadId, leads };
}

/** Finds descendants only inside the server-returned visible hierarchy. */
export function visibleDescendantIds(hierarchy: LeadHierarchy): ReadonlySet<number> {
  const childrenByParent = new Map<number, number[]>();
  for (const lead of hierarchy.leads) {
    if (lead.parentLeadId === null) continue;
    const children = childrenByParent.get(lead.parentLeadId) ?? [];
    children.push(lead.id);
    childrenByParent.set(lead.parentLeadId, children);
  }

  const descendants = new Set<number>();
  const pending = [...(childrenByParent.get(hierarchy.requestedLeadId) ?? [])];
  while (pending.length > 0) {
    const leadId = pending.pop();
    if (leadId === undefined || descendants.has(leadId)) continue;
    descendants.add(leadId);
    pending.push(...(childrenByParent.get(leadId) ?? []));
  }
  return descendants;
}
