import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import type { components } from "~/api/generated/schema";

import {
  marketingActivityPageRequestFromSearch,
  relatedObjectTypeLabel,
  supportsMarketingForm,
  toMarketingActivityCreateRequest,
  toMarketingActivityDraft,
  toMarketingActivityPage,
  toMarketingActivityUpdateRequest,
} from "./marketing-activity";

const activity: components["schemas"]["MarketingActivityResponse"] = {
  createdByActorId: 8,
  createdTime: "2026-08-08T12:00:00",
  endTime: "2026-09-02T17:00:00",
  id: 12,
  marketingFormId: 27,
  marketingFormPublicId: "demo-tenant.public-form-key",
  name: "秋季活动",
  oneSubmissionPerUser: true,
  participantActorIds: [8, 9],
  participantDepartmentIds: [17],
  relatedObjectType: "LEAD",
  startTime: "2026-09-02T09:00:00",
  status: "ACTIVE",
  submissionCount: 19,
  updatedTime: "2026-08-08T12:00:00",
  version: 3,
  viewCount: 70,
};

describe("marketing activity model", () => {
  it("maps the form draft to generated create and versioned update contracts", () => {
    const draft = toMarketingActivityDraft(activity, 8);
    draft.name = " 秋季线索活动 ";
    draft.timeRange = [dayjs("2026-09-03T09:00:00"), dayjs("2026-09-03T17:30:00")];

    expect(toMarketingActivityCreateRequest(draft)).toMatchObject({
      endTime: "2026-09-03T17:30:00",
      marketingFormId: 27,
      name: "秋季线索活动",
      participantActorIds: [8, 9],
      participantDepartmentIds: [17],
      relatedObjectType: "LEAD",
      submissionCount: 19,
      startTime: "2026-09-03T09:00:00",
      viewCount: 70,
    });
    expect(toMarketingActivityUpdateRequest(draft, activity)).toMatchObject({ version: 3 });
  });

  it("creates a target-matched form atomically for lead and customer activities", () => {
    const draft = toMarketingActivityDraft(null, 8, "CUSTOMER");
    expect(draft.relatedObjectType).toBe("CUSTOMER");
    draft.name = "秋季线索活动";
    draft.relatedObjectType = "LEAD";
    draft.timeRange = [dayjs("2026-09-03T09:00:00"), dayjs("2026-09-03T17:30:00")];
    draft.marketingFormMode = "CREATE";
    draft.marketingForm = {
      description: "留下联系方式以接收活动资料",
      fieldCodes: ["name", "mobile"],
      name: "秋季活动线索收集",
      submitButtonText: "提交报名",
      successMessage: "已收到你的报名。",
      title: "报名秋季活动",
    };
    const configuration: components["schemas"]["MarketingFormConfigurationOptionsResponse"] = {
      fields: [
        { displayName: "姓名", fieldCode: "name", fieldType: "TEXT", options: [], required: true },
        {
          displayName: "手机号",
          fieldCode: "mobile",
          fieldType: "PHONE",
          options: [],
          required: false,
        },
      ],
    };

    expect(toMarketingActivityCreateRequest(draft, configuration, true)).toMatchObject({
      marketingForm: {
        fields: [
          { fieldCode: "name", label: "姓名", required: true, sortOrder: 10 },
          { fieldCode: "mobile", label: "手机号", required: false, sortOrder: 20 },
        ],
        name: "秋季活动线索收集",
        targetObjectType: "LEAD",
        title: "报名秋季活动",
      },
      marketingFormId: undefined,
    });

    draft.relatedObjectType = "CUSTOMER";
    expect(toMarketingActivityCreateRequest(draft, configuration, true)).toMatchObject({
      marketingForm: { targetObjectType: "CUSTOMER" },
    });

    draft.relatedObjectType = "CONTACT";
    expect(() => toMarketingActivityCreateRequest(draft, configuration, true)).toThrow(
      "当前关联对象不支持公开表单。",
    );
    draft.relatedObjectType = "LEAD";
    expect(() => toMarketingActivityCreateRequest(draft, configuration)).toThrow(
      "当前关联对象不支持公开表单。",
    );
  });

  it("keeps server pagination untouched and labels only declared related object types", () => {
    const relatedObjectTypes = [
      { code: "CUSTOMER", displayName: "客户", supportsMarketingForm: true },
      { code: "CONTACT", displayName: "联系人", supportsMarketingForm: false },
      { code: "LEAD", displayName: "线索", supportsMarketingForm: true },
    ] as const;
    expect(
      toMarketingActivityPage({ objectList: [activity], pageNum: 2, pageSize: 15, totalNum: 16 }),
    ).toMatchObject({ page: 2, size: 15, total: 16 });
    expect(relatedObjectTypeLabel("CONTACT", relatedObjectTypes)).toBe("联系人");
    expect(relatedObjectTypeLabel("CONTACT", [])).toBe("CONTACT");
    expect(supportsMarketingForm("CUSTOMER", relatedObjectTypes)).toBe(true);
    expect(supportsMarketingForm("LEAD", relatedObjectTypes)).toBe(true);
    expect(supportsMarketingForm("CONTACT", relatedObjectTypes)).toBe(false);
    expect(supportsMarketingForm("LEAD", [])).toBe(false);
  });

  it("uses the reference default page size while keeping explicit URL sizes bounded", () => {
    expect(marketingActivityPageRequestFromSearch(new URLSearchParams())).toEqual({
      page: 1,
      size: 15,
    });
    expect(marketingActivityPageRequestFromSearch(new URLSearchParams("page=2&size=999"))).toEqual({
      page: 2,
      size: 200,
    });
  });
});
