import { toReceivablePlanListItem, type ReceivablePlanListItem } from "./receivable-plan-list-item";
import { recordOf } from "~/shared/utils/decode";

export interface ReceivablePlanOption {
  id: number;
  name: string;
}

/** Safe relation projection used only when a receivable form chooses a plan for one contract. */
export interface ReceivablePlanSelectionItem {
  contractId: number;
  customerId: number;
  dueDate: string | null;
  id: number;
  installment: number | null;
  progress: string | null;
  status: string | null;
  version: number;
}

/** Reduces a server-visible receivable plan to a money-free relation-selector label. */
export function toReceivablePlanOption(value: ReceivablePlanListItem): ReceivablePlanOption {
  return {
    id: value.id,
    name: value.installment === null ? `回款计划 ${value.id}` : `第 ${value.installment} 期`,
  };
}

/** Drops financial and other non-relation fields before a receivable form holds a plan candidate. */
export function toReceivablePlanSelectionItem(
  value: ReceivablePlanListItem,
): ReceivablePlanSelectionItem | null {
  if (value.customerId === null || value.contractId === null) return null;
  return {
    contractId: value.contractId,
    customerId: value.customerId,
    dueDate: value.dueDate,
    id: value.id,
    installment: value.installment,
    progress: value.progress,
    status: value.status,
    version: value.version,
  };
}

/** Decodes only stable IDs and installment labels from a visible plan query page. */
export function decodeReceivablePlanOptions(value: unknown): readonly ReceivablePlanOption[] {
  const objectList = recordOf(value)?.objectList;
  if (!Array.isArray(objectList)) {
    throw new Error("回款计划选择数据暂时不可用，请稍后重试。");
  }

  const known = new Set<number>();
  return objectList.flatMap((item) => {
    const plan = toReceivablePlanListItem(item);
    if (plan === null || known.has(plan.id)) return [];

    known.add(plan.id);
    return [toReceivablePlanOption(plan)];
  });
}
