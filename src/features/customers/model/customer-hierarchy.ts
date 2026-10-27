import { recordOf } from "~/shared/utils/decode";

export interface CustomerHierarchyNode {
  id: number;
  name: string;
  parentCustomerId: number | null;
}

export interface CustomerHierarchy {
  requestedCustomerId: number;
  customers: readonly CustomerHierarchyNode[];
}

function identifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalIdentifier(value: unknown): number | null {
  return value === null || value === undefined ? null : identifier(value);
}

/** Decodes only the server-visible nodes of a customer hierarchy. */
export function toCustomerHierarchy(
  value: unknown,
  expectedCustomerId: number,
): CustomerHierarchy | null {
  const source = recordOf(value);
  if (source === null || identifier(source.requestedCustomerId) !== expectedCustomerId) return null;
  if (!Array.isArray(source.customers)) return null;

  const identifiers = new Set<number>();
  const customers: CustomerHierarchyNode[] = [];
  for (const value of source.customers) {
    const customer = recordOf(value);
    if (customer === null) return null;

    const id = identifier(customer.id);
    const name = customer.name;
    const parentCustomerId = optionalIdentifier(customer.parentCustomerId);
    if (
      id === null ||
      typeof name !== "string" ||
      name.length === 0 ||
      (customer.parentCustomerId !== null &&
        customer.parentCustomerId !== undefined &&
        parentCustomerId === null) ||
      identifiers.has(id)
    ) {
      return null;
    }

    identifiers.add(id);
    customers.push({ id, name, parentCustomerId });
  }

  if (!identifiers.has(expectedCustomerId)) return null;
  return { requestedCustomerId: expectedCustomerId, customers };
}

/** Finds descendants only inside the server-returned visible hierarchy. */
export function visibleDescendantIds(hierarchy: CustomerHierarchy): ReadonlySet<number> {
  const childrenByParent = new Map<number, number[]>();
  for (const customer of hierarchy.customers) {
    if (customer.parentCustomerId === null) continue;
    const children = childrenByParent.get(customer.parentCustomerId) ?? [];
    children.push(customer.id);
    childrenByParent.set(customer.parentCustomerId, children);
  }

  const descendants = new Set<number>();
  const pending = [...(childrenByParent.get(hierarchy.requestedCustomerId) ?? [])];
  while (pending.length > 0) {
    const customerId = pending.pop();
    if (customerId === undefined || descendants.has(customerId)) continue;
    descendants.add(customerId);
    pending.push(...(childrenByParent.get(customerId) ?? []));
  }
  return descendants;
}
