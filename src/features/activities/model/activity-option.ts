import { recordOf } from "~/shared/utils/decode";

export interface ActivityMethodOption {
  value: string;
  label: string;
}

interface OrderedActivityMethodOption extends ActivityMethodOption {
  displayOrder: number;
}

function displayOrderOf(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function unavailable(): Error {
  return new Error("跟进方式数据暂时不可用，请稍后重试。");
}

/**
 * Keeps the create form limited to method choices explicitly governed by the
 * server. Templates and their fields stay outside this initial write boundary.
 */
export function decodeActivityMethodOptions(value: unknown): readonly ActivityMethodOption[] {
  if (!Array.isArray(value)) throw unavailable();

  const knownValues = new Set<string>();
  const methods: OrderedActivityMethodOption[] = [];
  for (const source of value) {
    const option = recordOf(source);
    if (option?.type !== "METHOD") continue;

    const optionValue = option.value;
    const label = option.label;
    const displayOrder = displayOrderOf(option.displayOrder);
    if (
      typeof optionValue !== "string" ||
      optionValue.trim().length === 0 ||
      typeof label !== "string" ||
      label.trim().length === 0 ||
      displayOrder === null ||
      knownValues.has(optionValue)
    ) {
      throw unavailable();
    }

    knownValues.add(optionValue);
    methods.push({ displayOrder, label, value: optionValue });
  }

  if (methods.length === 0) throw unavailable();

  return methods
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map(({ label, value: optionValue }) => ({ label, value: optionValue }));
}
