import { recordOf } from "~/shared/utils/decode";

export const customFieldTypes = [
  "TEXT",
  "TEXTAREA",
  "SELECT",
  "MULTI_SELECT",
  "DATE",
  "DATETIME",
  "INTEGER",
  "DECIMAL",
  "BOOLEAN",
  "EMAIL",
  "PHONE",
  "URL",
  "FILE",
  "USER",
  "DEPARTMENT",
  "RELATION",
  "ADDRESS",
] as const;

export type CustomFieldType = (typeof customFieldTypes)[number];

export const fieldAccessLevels = ["HIDDEN", "READ", "WRITE"] as const;
export type FieldAccessLevel = (typeof fieldAccessLevels)[number];

export const fieldMaskTypes = ["NONE", "PARTIAL", "FULL"] as const;
export type FieldMaskType = (typeof fieldMaskTypes)[number];

export interface EffectiveFieldAccess {
  level: FieldAccessLevel;
  maskType: FieldMaskType;
}

export interface FieldOption {
  value: string;
  label: string;
  order: number;
}

/**
 * A narrow, presentation-only projection of the field metadata response.
 *
 * The current OpenAPI snapshot does not describe its success payload. Keep this
 * projection deliberately small and decode it at the API boundary instead of
 * maintaining a hand-written copy of the server DTO.
 */
export interface FieldDefinition {
  code: string;
  displayName: string;
  fieldType: CustomFieldType;
  builtin: boolean;
  required: boolean;
  searchable: boolean;
  status: "ACTIVE" | "INACTIVE";
  displayOrder: number;
  sectionName: string | null;
  options: readonly FieldOption[];
}

export class FieldMetadataContractError extends Error {
  constructor() {
    super("字段配置数据暂时不可用，请稍后重试。");
    this.name = "FieldMetadataContractError";
  }
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function optionalBoolean(value: unknown): boolean {
  return value === true;
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function isCustomFieldType(value: unknown): value is CustomFieldType {
  return typeof value === "string" && customFieldTypes.includes(value as CustomFieldType);
}

function isFieldStatus(value: unknown): value is FieldDefinition["status"] {
  return value === "ACTIVE" || value === "INACTIVE";
}

function toFieldOption(value: unknown): FieldOption | null {
  const source = recordOf(value);
  if (!source) return null;

  const optionValue = requiredString(source.value);
  const label = requiredString(source.label);
  if (optionValue === null || label === null) return null;

  return { value: optionValue, label, order: nonNegativeInteger(source.order) };
}

export function toFieldDefinition(value: unknown): FieldDefinition | null {
  const source = recordOf(value);
  if (!source) return null;

  const code = requiredString(source.code);
  const displayName = requiredString(source.displayName);
  if (
    code === null ||
    displayName === null ||
    !isCustomFieldType(source.fieldType) ||
    !isFieldStatus(source.status)
  ) {
    return null;
  }

  return {
    code,
    displayName,
    fieldType: source.fieldType,
    builtin: optionalBoolean(source.builtin),
    required: optionalBoolean(source.required),
    searchable: optionalBoolean(source.searchable),
    status: source.status,
    displayOrder: nonNegativeInteger(source.displayOrder),
    sectionName: requiredString(source.sectionName),
    options: Array.isArray(source.options)
      ? source.options.map(toFieldOption).filter((option): option is FieldOption => option !== null)
      : [],
  };
}

export function decodeFieldDefinitions(payload: unknown): readonly FieldDefinition[] {
  if (!Array.isArray(payload)) throw new FieldMetadataContractError();

  const knownCodes = new Set<string>();
  return payload.flatMap((value) => {
    const field = toFieldDefinition(value);
    if (field === null || knownCodes.has(field.code)) return [];

    knownCodes.add(field.code);
    return [field];
  });
}

export function hasFieldAccess(access: EffectiveFieldAccess, level: FieldAccessLevel): boolean {
  return fieldAccessLevels.indexOf(access.level) >= fieldAccessLevels.indexOf(level);
}
