import type { FieldDefinition } from "./field-definition";
import { recordOf } from "~/shared/utils/decode";

export interface FieldLayout {
  objectType: string;
  orderedCodes: readonly string[];
  hiddenCodes: readonly string[];
  pinnedCodes: readonly string[];
  columnWidths: Readonly<Record<string, number>>;
  version: number | null;
}

export interface LaidOutField {
  definition: FieldDefinition;
  pinned: boolean;
  width: number | null;
}

export interface FieldSection {
  name: string;
  fields: readonly LaidOutField[];
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function stringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];

  const unique = new Set<string>();
  for (const item of value) {
    const text = requiredString(item);
    if (text !== null) unique.add(text);
  }
  return [...unique];
}

function optionalVersion(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function columnWidths(value: unknown): Readonly<Record<string, number>> {
  const source = recordOf(value);
  if (!source) return {};

  const result: Record<string, number> = {};
  for (const [code, width] of Object.entries(source)) {
    if (
      requiredString(code) !== null &&
      typeof width === "number" &&
      Number.isSafeInteger(width) &&
      width > 0
    ) {
      result[code] = width;
    }
  }
  return result;
}

export function decodeFieldLayout(payload: unknown): FieldLayout {
  const source = recordOf(payload);
  if (source === null) throw new Error("字段布局数据暂时不可用，请稍后重试。");

  const objectType = requiredString(source.objectType);
  if (objectType === null) throw new Error("字段布局数据暂时不可用，请稍后重试。");

  return {
    objectType,
    orderedCodes: stringList(source.orderedCodes),
    hiddenCodes: stringList(source.hiddenCodes),
    pinnedCodes: stringList(source.pinnedCodes),
    columnWidths: columnWidths(source.columnWidths),
    version: optionalVersion(source.version),
  };
}

export function applyFieldLayout(
  definitions: readonly FieldDefinition[],
  layout: FieldLayout,
): readonly LaidOutField[] {
  const orderedIndex = new Map(layout.orderedCodes.map((code, index) => [code, index]));
  const hiddenCodes = new Set(layout.hiddenCodes);
  const pinnedCodes = new Set(layout.pinnedCodes);

  return definitions
    .filter((definition) => definition.status === "ACTIVE" && !hiddenCodes.has(definition.code))
    .map((definition) => ({
      definition,
      pinned: pinnedCodes.has(definition.code),
      width: layout.columnWidths[definition.code] ?? null,
    }))
    .sort((left, right) => {
      const leftOrder = orderedIndex.get(left.definition.code) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = orderedIndex.get(right.definition.code) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      if (left.definition.displayOrder !== right.definition.displayOrder) {
        return left.definition.displayOrder - right.definition.displayOrder;
      }
      return left.definition.code.localeCompare(right.definition.code);
    });
}

export function groupFieldSections(fields: readonly LaidOutField[]): readonly FieldSection[] {
  const sections = new Map<string, LaidOutField[]>();
  for (const field of fields) {
    const name = field.definition.sectionName ?? "未分组";
    const section = sections.get(name) ?? [];
    section.push(field);
    sections.set(name, section);
  }

  return [...sections.entries()].map(([name, sectionFields]) => ({ name, fields: sectionFields }));
}
