import { z } from "zod";

import type { components } from "~/api/generated/schema";

export const contactListDuplicateCheckSchema = z
  .object({
    name: z.string().trim().max(200, "联系人姓名不能超过 200 个字符"),
    phoneNumber: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || /^\+[1-9]\d{7,14}$/.test(value),
        "手机号需使用 + 国家码格式，例如 +8613812345678",
      ),
  })
  .refine((values) => values.name.length > 0 || values.phoneNumber.length > 0, {
    message: "请填写联系人姓名或联系电话",
    path: ["name"],
  });

export type ContactListDuplicateCheckValues = z.infer<typeof contactListDuplicateCheckSchema>;

export const emptyContactListDuplicateCheckValues: ContactListDuplicateCheckValues = {
  name: "",
  phoneNumber: "",
};

export function toContactListDuplicateCheckRequest(
  values: ContactListDuplicateCheckValues,
): components["schemas"]["ContactDuplicateCheckRequest"] {
  return {
    name: values.name.trim() || undefined,
    phoneNumber: values.phoneNumber.trim() || undefined,
  };
}
