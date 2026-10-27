import { toContractListItem } from "./contract-list-item";
import { recordOf } from "~/shared/utils/decode";

export interface ContractOption {
  id: number;
  name: string;
}

interface ContractOptionSource {
  id: number;
  name: string | null;
  number: string | null;
}

/** Reduces a server-visible contract to a relation-selector label without money fields. */
export function toContractOption(value: ContractOptionSource): ContractOption {
  return {
    id: value.id,
    name: value.name ?? value.number ?? `合同 ${value.id}`,
  };
}

/** Decodes only stable contract identities and display labels from a query page. */
export function decodeContractOptions(value: unknown): readonly ContractOption[] {
  const objectList = recordOf(value)?.objectList;
  if (!Array.isArray(objectList)) {
    throw new Error("合同选择数据暂时不可用，请稍后重试。");
  }

  const known = new Set<number>();
  return objectList.flatMap((item) => {
    const contract = toContractListItem(item);
    if (contract === null || known.has(contract.id)) return [];

    known.add(contract.id);
    return [toContractOption(contract)];
  });
}
