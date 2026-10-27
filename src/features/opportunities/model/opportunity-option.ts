import { toOpportunityListItem, type OpportunityListItem } from "./opportunity-list-item";
import { recordOf } from "~/shared/utils/decode";

export interface OpportunityOption {
  id: number;
  name: string;
}

/** Reduces a server-visible opportunity to the identity and name required by a relation selector. */
export function toOpportunityOption(value: OpportunityListItem): OpportunityOption {
  return { id: value.id, name: value.name };
}

/** Decodes only stable opportunity identities and names from a query page. */
export function decodeOpportunityOptions(value: unknown): readonly OpportunityOption[] {
  const objectList = recordOf(value)?.objectList;
  if (!Array.isArray(objectList)) {
    throw new Error("商机选择数据暂时不可用，请稍后重试。");
  }

  const known = new Set<number>();
  return objectList.flatMap((item) => {
    const opportunity = toOpportunityListItem(item);
    if (opportunity === null || known.has(opportunity.id)) return [];

    known.add(opportunity.id);
    return [toOpportunityOption(opportunity)];
  });
}
