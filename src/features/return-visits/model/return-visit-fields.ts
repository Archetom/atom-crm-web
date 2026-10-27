import type { components } from "~/api/generated/schema";

export type ReturnVisitForm = NonNullable<
  components["schemas"]["ReturnVisitCreateRequest"]["visitForm"]
>;
export type ReturnVisitSatisfaction = NonNullable<
  components["schemas"]["ReturnVisitCreateRequest"]["satisfaction"]
>;

const returnVisitFormLabels: Record<ReturnVisitForm, string> = {
  EMAIL: "邮件",
  IN_PERSON: "见面拜访",
  PHONE: "电话",
  SMS: "短信",
  WECHAT: "微信",
};

const returnVisitSatisfactionLabels: Record<ReturnVisitSatisfaction, string> = {
  DISSATISFIED: "不满意",
  NEUTRAL: "一般",
  SATISFIED: "满意",
  VERY_DISSATISFIED: "很不满意",
  VERY_SATISFIED: "很满意",
};

export const returnVisitFormOptions = Object.entries(returnVisitFormLabels).map(
  ([value, label]) => ({ label, value: value as ReturnVisitForm }),
);

export const returnVisitSatisfactionOptions = Object.entries(returnVisitSatisfactionLabels).map(
  ([value, label]) => ({ label, value: value as ReturnVisitSatisfaction }),
);

export function toReturnVisitForm(value: unknown): ReturnVisitForm | null {
  return typeof value === "string" && value in returnVisitFormLabels
    ? (value as ReturnVisitForm)
    : null;
}

export function toReturnVisitSatisfaction(value: unknown): ReturnVisitSatisfaction | null {
  return typeof value === "string" && value in returnVisitSatisfactionLabels
    ? (value as ReturnVisitSatisfaction)
    : null;
}

export function returnVisitFormLabel(value: ReturnVisitForm | null): string {
  return value === null ? "—" : returnVisitFormLabels[value];
}

export function returnVisitSatisfactionLabel(value: ReturnVisitSatisfaction | null): string {
  return value === null ? "—" : returnVisitSatisfactionLabels[value];
}
