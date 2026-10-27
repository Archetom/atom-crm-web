import type { components } from "~/api/generated/schema";
import { recordOf } from "~/shared/utils/decode";

export type ReturnVisitRelationKind = "contact" | "contract";

export interface ReturnVisitRelationOption {
  id: number;
  name: string;
}

/**
 * Keeps only candidates the server returned with a visible name and the current
 * customer relation. The source endpoints independently recheck both record
 * visibility and CUSTOMER field access.
 */
export function decodeReturnVisitRelationOptions(
  pager: components["schemas"]["Pager"],
  customerId: number,
): readonly ReturnVisitRelationOption[] {
  const known = new Set<number>();
  return (pager.objectList ?? []).flatMap((value) => {
    const source = recordOf(value);
    const id = source?.id;
    const name = source?.name;
    if (
      typeof id !== "number" ||
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof name !== "string" ||
      name.trim().length === 0 ||
      source?.customerId !== customerId ||
      known.has(id)
    ) {
      return [];
    }

    known.add(id);
    return [{ id, name }];
  });
}
