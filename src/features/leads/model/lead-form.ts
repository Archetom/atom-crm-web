import { z } from "zod";

import type { components } from "~/api/generated/schema";
import {
  toCustomFieldFormValues,
  type CustomFieldValues,
  type FieldDefinition,
} from "~/components/dynamic-field";

import type { LeadDetail } from "./lead-detail";
import { normalizeLeadTagDraft } from "./lead-tag";

export const leadBaseFormSchema = z
  .object({
    name: z.string().trim().min(1, "请输入线索名称").max(200, "线索名称不能超过 200 个字符"),
    phoneNumber: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || /^\+[1-9]\d{7,14}$/.test(value),
        "手机号需使用 + 国家码格式，例如 +8613812345678",
      ),
    telephone: z.string().trim().max(50, "座机不能超过 50 个字符"),
    jobTitle: z.string().trim().max(200, "职务不能超过 200 个字符"),
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
    nextContactTime: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),
        "请选择有效的下次联系时间",
      ),
    addressLine: z.string().trim().max(500, "详细地址不能超过 500 个字符"),
    addressRegion: z.string().trim().max(100, "地区不能超过 100 个字符"),
    addressCity: z.string().trim().max(100, "城市不能超过 100 个字符"),
    addressPostalCode: z.string().trim().max(30, "邮编不能超过 30 个字符"),
    tags: z
      .array(z.string())
      .refine(
        (values) => normalizeLeadTagDraft(values) !== null,
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

export type LeadBaseFormValues = z.infer<typeof leadBaseFormSchema>;

/** File IDs can only originate from an unexpired server-issued LEAD draft. */
export interface LeadFileFieldSubmission {
  draftId: number;
  fields: Readonly<Record<string, readonly number[]>>;
}

export interface LeadCreateAdditionalValues {
  customFields?: CustomFieldValues;
  fileFieldSubmission?: LeadFileFieldSubmission;
}

export interface LeadCustomFieldUpdateValues {
  changedCodes: ReadonlySet<string>;
  customFields: CustomFieldValues;
  version: number;
}

export const emptyLeadBaseFormValues: LeadBaseFormValues = {
  name: "",
  phoneNumber: "",
  telephone: "",
  jobTitle: "",
  email: "",
  website: "",
  description: "",
  nextContactTime: "",
  addressLine: "",
  addressRegion: "",
  addressCity: "",
  addressPostalCode: "",
  tags: [],
  ownerActorId: undefined,
};

function optionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function dateTimeLocalValue(value: string | null): string {
  const normalized = value?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized) ? normalized.slice(0, 16) : "";
}

export function toLeadCreateRequest(
  values: LeadBaseFormValues,
  customerId?: number,
  additionalValues?: LeadCreateAdditionalValues,
): components["schemas"]["LeadCreateRequest"] {
  const request: components["schemas"]["LeadCreateRequest"] = {
    name: values.name.trim(),
    phoneNumber: optionalText(values.phoneNumber),
    telephone: optionalText(values.telephone),
    jobTitle: optionalText(values.jobTitle),
    email: optionalText(values.email),
    website: optionalText(values.website),
    description: optionalText(values.description),
    nextContactTime: optionalText(values.nextContactTime),
    ownerActorId: values.ownerActorId,
  };
  const tags = normalizeLeadTagDraft(values.tags);
  if (tags !== null && tags.length > 0) request.tags = tags;
  if (customerId !== undefined && Number.isSafeInteger(customerId) && customerId > 0) {
    request.customerId = customerId;
  }
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
  const customFields = Object.fromEntries(
    Object.entries(additionalValues?.customFields ?? {}).flatMap(([code, fieldValues]) => {
      const normalized = [...new Set(fieldValues.map((value) => value.trim()).filter(Boolean))];
      return normalized.length === 0 ? [] : [[code, normalized]];
    }),
  );
  if (Object.keys(customFields).length > 0) request.customFields = customFields;
  const fileFieldSubmission = additionalValues?.fileFieldSubmission;
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
  return request;
}

export function toLeadDuplicateCheckRequest(
  values: LeadBaseFormValues,
  excludedLeadId?: number,
): components["schemas"]["LeadDuplicateCheckRequest"] {
  return {
    excludedLeadId,
    name: values.name.trim(),
    phoneNumber: optionalText(values.phoneNumber),
  };
}

export function leadBaseFormValuesFromDetail(lead: LeadDetail): LeadBaseFormValues {
  return {
    name: lead.name,
    phoneNumber: lead.phoneNumber ?? "",
    telephone: lead.telephone ?? "",
    jobTitle: lead.jobTitle ?? "",
    email: lead.email ?? "",
    website: lead.website ?? "",
    description: lead.description ?? "",
    nextContactTime: dateTimeLocalValue(lead.nextContactTime),
    addressLine: "",
    addressRegion: "",
    addressCity: "",
    addressPostalCode: "",
    tags: [],
  };
}

/**
 * The update request preserves optimistic locking and submits only changed
 * text fields and the next-contact time. Customer relation, addresses,
 * dynamic fields, and files remain independent visibility-aware workflows.
 */
export function toLeadUpdateRequest(
  values: LeadBaseFormValues,
  baseline: LeadBaseFormValues,
  version: number,
): components["schemas"]["LeadUpdateRequest"] {
  const request: components["schemas"]["LeadUpdateRequest"] = { version };
  const fields = [
    "name",
    "phoneNumber",
    "telephone",
    "jobTitle",
    "email",
    "website",
    "description",
  ] as const;
  for (const field of fields) {
    if (values[field] !== baseline[field]) request[field] = values[field].trim();
  }
  if (values.nextContactTime !== baseline.nextContactTime) {
    request.nextContactTime = optionalText(values.nextContactTime) ?? null;
  }
  return request;
}

/**
 * Lead updates merge submitted dynamic codes into server state. Detail values
 * never seed this form, so only explicit input or clearing can cross the
 * write boundary; omitted codes remain owned by the server.
 */
export function toLeadCustomFieldUpdateRequest(
  definitions: readonly FieldDefinition[],
  values: LeadCustomFieldUpdateValues,
): components["schemas"]["LeadUpdateRequest"] {
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
