import type { CustomFieldValues } from "./custom-field-values";
import type { CustomFieldType, FieldDefinition } from "./field-definition";

const supportedFormFieldTypes = [
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
  "USER",
  "DEPARTMENT",
  "ADDRESS",
] as const satisfies readonly CustomFieldType[];

export type SupportedCustomFieldFormType = (typeof supportedFormFieldTypes)[number];

export interface CustomFieldFormValidationIssue {
  code: string;
  message: string;
}

function isSupportedFormFieldType(
  fieldType: CustomFieldType,
): fieldType is SupportedCustomFieldFormType {
  return supportedFormFieldTypes.includes(fieldType as SupportedCustomFieldFormType);
}

function normalizedValues(values: readonly string[] | undefined): readonly string[] {
  if (values === undefined) return [];

  const unique = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length > 0) unique.add(normalized);
  }
  return [...unique];
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.host.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
}

function hasValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hasValidDateTime(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/.test(value) &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function invalidValueMessage(field: FieldDefinition, values: readonly string[]): string | null {
  if (values.length > 50) return `${field.displayName}最多支持 50 个值`;
  if (values.some((value) => value.length > 500)) return `${field.displayName}不能超过 500 个字符`;

  switch (field.fieldType) {
    case "SELECT":
      if (values.length !== 1) return `${field.displayName}请选择一项`;
      return field.options.some((option) => option.value === values[0])
        ? null
        : `${field.displayName}包含无效选项`;
    case "MULTI_SELECT":
      return values.every((value) => field.options.some((option) => option.value === value))
        ? null
        : `${field.displayName}包含无效选项`;
    case "DATE":
      return values.length === 1 && hasValidDate(values[0]) ? null : `${field.displayName}日期无效`;
    case "DATETIME":
      return values.length === 1 && hasValidDateTime(values[0])
        ? null
        : `${field.displayName}日期时间无效`;
    case "INTEGER":
      return values.length === 1 && /^[-+]?\d+$/.test(values[0])
        ? null
        : `${field.displayName}请输入整数`;
    case "DECIMAL":
      return values.length === 1 && /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(values[0])
        ? null
        : `${field.displayName}请输入小数`;
    case "BOOLEAN":
      return values.length === 1 && (values[0] === "true" || values[0] === "false")
        ? null
        : `${field.displayName}请选择是或否`;
    case "USER":
    case "DEPARTMENT":
      return values.every((value) => /^[1-9]\d*$/.test(value))
        ? null
        : `${field.displayName}包含无效候选项`;
    case "EMAIL":
      return values.length === 1 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values[0])
        ? null
        : `${field.displayName}邮箱无效`;
    case "PHONE":
      return values.length === 1 && /^\+[1-9]\d{7,14}$/.test(values[0])
        ? null
        : `${field.displayName}需使用 + 国家码格式`;
    case "URL":
      return values.length === 1 && isHttpUrl(values[0]) ? null : `${field.displayName}网址无效`;
    case "TEXT":
    case "TEXTAREA":
    case "ADDRESS":
      return values.length === 1 ? null : `${field.displayName}请输入一项内容`;
    default:
      return `${field.displayName}暂不支持在此表单填写`;
  }
}

/**
 * USER and DEPARTMENT use only IDs emitted by their server-visible directory
 * controls. FILE and RELATION retain their dedicated workflows.
 */
export function customFieldFormDefinitions(
  definitions: readonly FieldDefinition[],
): readonly FieldDefinition[] {
  return definitions
    .filter(
      (field) =>
        !field.builtin && field.status === "ACTIVE" && isSupportedFormFieldType(field.fieldType),
    )
    .sort(
      (left, right) =>
        left.displayOrder - right.displayOrder || left.code.localeCompare(right.code),
    );
}

/** FILE values travel through a one-shot draft and are never included in scalar customFields. */
export function customFileFieldDefinitions(
  definitions: readonly FieldDefinition[],
): readonly FieldDefinition[] {
  return definitions
    .filter((field) => !field.builtin && field.status === "ACTIVE" && field.fieldType === "FILE")
    .sort(
      (left, right) =>
        left.displayOrder - right.displayOrder || left.code.localeCompare(right.code),
    );
}

/**
 * These fields must not be silently omitted from a create request when the
 * catalog marks them required. FILE has a governed draft-upload flow;
 * RELATION has no customer-owning module in the current backend contract.
 */
export function unsupportedRequiredCustomFieldDefinitions(
  definitions: readonly FieldDefinition[],
): readonly FieldDefinition[] {
  return definitions.filter(
    (field) =>
      !field.builtin &&
      field.status === "ACTIVE" &&
      field.required &&
      field.fieldType === "RELATION",
  );
}

/**
 * Keeps submitted values tied to the current server catalog and omits blank
 * optional fields. Codes never come from user input; callers pass definitions
 * returned by the server for the current tenant and actor context.
 */
export function toCustomFieldFormValues(
  definitions: readonly FieldDefinition[],
  values: CustomFieldValues,
): CustomFieldValues {
  return Object.fromEntries(
    customFieldFormDefinitions(definitions).flatMap((field) => {
      const fieldValues = normalizedValues(values[field.code]);
      return fieldValues.length === 0 ? [] : [[field.code, fieldValues]];
    }),
  );
}

/** Validates the scalar controls before a mutation; the server remains authoritative. */
export function validateCustomFieldFormValues(
  definitions: readonly FieldDefinition[],
  values: CustomFieldValues,
): readonly CustomFieldFormValidationIssue[] {
  return customFieldFormDefinitions(definitions).flatMap((field) => {
    const fieldValues = normalizedValues(values[field.code]);
    if (fieldValues.length === 0) {
      return field.required ? [{ code: field.code, message: `${field.displayName}为必填项` }] : [];
    }

    const message = invalidValueMessage(field, fieldValues);
    return message === null ? [] : [{ code: field.code, message }];
  });
}
