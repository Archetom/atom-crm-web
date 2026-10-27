import { z } from "zod";

import type { components } from "~/api/generated/schema";
import {
  toCustomFieldFormValues,
  type CustomFieldValues,
  type FieldDefinition,
} from "~/components/dynamic-field";

import type { CustomerDetail } from "./customer-detail";
import { normalizeCustomerTagDraft } from "./customer-tag";

export const customerBaseFormSchema = z
  .object({
    name: z.string().trim().min(1, "请输入客户名称").max(200, "客户名称不能超过 200 个字符"),
    phoneNumber: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || /^\+[1-9]\d{7,14}$/.test(value),
        "手机号需使用 + 国家码格式，例如 +8613812345678",
      ),
    telephone: z.string().trim().max(50, "座机不能超过 50 个字符"),
    email: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || z.email().safeParse(value).success,
        "请输入有效邮箱地址",
      )
      .refine((value) => value.length <= 254, "邮箱不能超过 254 个字符"),
    website: z.string().trim().max(500, "网站不能超过 500 个字符"),
    description: z.string().trim().max(2000, "说明不能超过 2000 个字符"),
    addressLine: z.string().trim().max(500, "详细地址不能超过 500 个字符"),
    addressRegion: z.string().trim().max(100, "地区不能超过 100 个字符"),
    addressCity: z.string().trim().max(100, "城市不能超过 100 个字符"),
    addressPostalCode: z.string().trim().max(30, "邮编不能超过 30 个字符"),
    customFields: z.record(z.string(), z.array(z.string()).max(50)),
    tags: z
      .array(z.string())
      .refine(
        (values) => normalizeCustomerTagDraft(values) !== null,
        "标签不能为空、重复或超过长度限制",
      ),
    ownerActorId: z.number().int().positive().optional(),
  })
  .refine(
    (values) =>
      values.addressLine.length > 0 ||
      (values.addressRegion.length === 0 &&
        values.addressCity.length === 0 &&
        values.addressPostalCode.length === 0),
    { message: "填写地区、城市或邮编时，请同时填写详细地址", path: ["addressLine"] },
  );

export type CustomerBaseFormValues = z.infer<typeof customerBaseFormSchema>;

export interface CustomerFileFieldSubmission {
  draftId: number;
  fields: Readonly<Record<string, readonly number[]>>;
}

export interface CustomerCustomFieldUpdateValues {
  changedCodes: ReadonlySet<string>;
  customFields: CustomFieldValues;
  version: number;
}

export const emptyCustomerBaseFormValues: CustomerBaseFormValues = {
  name: "",
  phoneNumber: "",
  telephone: "",
  email: "",
  website: "",
  description: "",
  addressLine: "",
  addressRegion: "",
  addressCity: "",
  addressPostalCode: "",
  customFields: {},
  tags: [],
  ownerActorId: undefined,
};

function optionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function toCustomerCreateRequest(
  values: CustomerBaseFormValues,
  parentCustomerId?: number,
  fileFieldSubmission?: CustomerFileFieldSubmission,
): components["schemas"]["CustomerCreateRequest"] {
  const request: components["schemas"]["CustomerCreateRequest"] = {
    name: values.name.trim(),
    phoneNumber: optionalText(values.phoneNumber),
    telephone: optionalText(values.telephone),
    email: optionalText(values.email),
    website: optionalText(values.website),
    description: optionalText(values.description),
    ownerActorId: values.ownerActorId,
  };
  const tags = normalizeCustomerTagDraft(values.tags);
  if (tags !== null && tags.length > 0) request.tags = [...tags];
  const addressLine = optionalText(values.addressLine);
  if (addressLine !== undefined) {
    request.addresses = [
      {
        addressLine,
        region: optionalText(values.addressRegion),
        city: optionalText(values.addressCity),
        postalCode: optionalText(values.addressPostalCode),
        primary: true,
      },
    ];
  }
  const customFields: Record<string, string[]> = Object.fromEntries(
    Object.entries(values.customFields).flatMap(([code, fieldValues]) => {
      const normalized = [...new Set(fieldValues.map((value) => value.trim()).filter(Boolean))];
      return normalized.length === 0 ? [] : [[code, normalized]];
    }),
  );
  if (Object.keys(customFields).length > 0) request.customFields = customFields;
  if (
    fileFieldSubmission !== undefined &&
    Number.isSafeInteger(fileFieldSubmission.draftId) &&
    fileFieldSubmission.draftId > 0
  ) {
    const fileFields = Object.fromEntries(
      Object.entries(fileFieldSubmission.fields).flatMap(([code, fileIds]) => {
        const normalized = [...new Set(fileIds)].filter(
          (fileId) => Number.isSafeInteger(fileId) && fileId > 0,
        );
        return normalized.length === 0 ? [] : [[code, normalized]];
      }),
    );
    if (Object.keys(fileFields).length > 0) {
      request.fileFieldDraftId = fileFieldSubmission.draftId;
      request.fileFields = fileFields;
    }
  }
  if (
    parentCustomerId !== undefined &&
    Number.isSafeInteger(parentCustomerId) &&
    parentCustomerId > 0
  ) {
    request.parentCustomerId = parentCustomerId;
  }
  return request;
}

export function toCustomerDuplicateCheckRequest(
  values: CustomerBaseFormValues,
  excludedCustomerId?: number,
): components["schemas"]["CustomerDuplicateCheckRequest"] {
  return {
    excludedCustomerId,
    name: values.name.trim(),
    phoneNumber: optionalText(values.phoneNumber),
  };
}

export function customerBaseFormValuesFromDetail(customer: CustomerDetail): CustomerBaseFormValues {
  return {
    name: customer.name,
    phoneNumber: customer.phoneNumber ?? "",
    telephone: customer.telephone ?? "",
    email: customer.email ?? "",
    website: customer.website ?? "",
    description: customer.description ?? "",
    addressLine: "",
    addressRegion: "",
    addressCity: "",
    addressPostalCode: "",
    customFields: {},
    tags: [],
  };
}

export function toCustomerUpdateRequest(
  values: CustomerBaseFormValues,
  baseline: CustomerBaseFormValues,
  version: number,
): components["schemas"]["CustomerUpdateRequest"] {
  const request: components["schemas"]["CustomerUpdateRequest"] = { version };
  // Dynamic fields intentionally stay out of this narrow edit baseline until
  // the server can return per-field writable, unmasked values for this actor.
  const fields = ["name", "phoneNumber", "telephone", "email", "website", "description"] as const;
  for (const field of fields) {
    if (values[field] !== baseline[field]) request[field] = values[field].trim();
  }
  return request;
}

/**
 * Customer updates merge submitted dynamic codes into server state. Detail
 * values never seed this form, so only explicit input or clearing can cross
 * the write boundary; omitted codes remain owned by the server.
 */
export function toCustomerCustomFieldUpdateRequest(
  definitions: readonly FieldDefinition[],
  values: CustomerCustomFieldUpdateValues,
): components["schemas"]["CustomerUpdateRequest"] {
  const definitionsByCode = new Map(definitions.map((definition) => [definition.code, definition]));
  const customFields = Object.fromEntries(
    [...values.changedCodes].flatMap((code) => {
      const definition = definitionsByCode.get(code);
      if (definition === undefined) return [];
      const normalized =
        toCustomFieldFormValues([definition], {
          [code]: values.customFields[code] ?? [],
        })[code] ?? [];
      return [[code, normalized]];
    }),
  );

  return {
    customFields: Object.fromEntries(
      Object.entries(customFields).map(([code, fieldValues]) => [code, [...fieldValues]]),
    ),
    version: values.version,
  };
}
