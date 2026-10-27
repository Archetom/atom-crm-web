import { describe, expect, it } from "vitest";

import {
  hasOpportunityUpdateChanges,
  isCompleteOpportunityEditableBaseline,
  opportunityUpdateValuesFromBaseline,
  toOpportunityCreateRequest,
  toOpportunityCustomFieldUpdateRequest,
  toOpportunityEditableBaseline,
  toOpportunityUpdateRequest,
} from "./opportunity-form";
import type { FieldDefinition } from "~/components/dynamic-field";

describe("toOpportunityCreateRequest", () => {
  it("keeps the create payload within the server-selected baseline fields", () => {
    expect(
      toOpportunityCreateRequest({
        customerId: 7,
        name: " 年度续约 ",
        pipelineCode: "direct",
        stageCode: "discovery",
      }),
    ).toEqual({
      customerId: 7,
      name: "年度续约",
      pipelineCode: "direct",
      stageCode: "discovery",
    });
  });

  it("sends an owner only when explicitly selected from the member directory", () => {
    expect(
      toOpportunityCreateRequest({
        customerId: 7,
        name: " 年度续约 ",
        ownerActorId: 9,
        pipelineCode: "direct",
        stageCode: "discovery",
      }),
    ).toEqual({
      customerId: 7,
      name: "年度续约",
      ownerActorId: 9,
      pipelineCode: "direct",
      stageCode: "discovery",
    });
  });

  it("keeps only explicitly selected contact IDs and a primary contact within that selection", () => {
    expect(
      toOpportunityCreateRequest({
        contactIds: [12, 12, -1],
        customerId: 7,
        name: " 年度续约 ",
        pipelineCode: "direct",
        primaryContactId: 12,
        stageCode: "discovery",
      }),
    ).toEqual({
      contactIds: [12],
      customerId: 7,
      name: "年度续约",
      pipelineCode: "direct",
      primaryContactId: 12,
      stageCode: "discovery",
    });

    expect(
      toOpportunityCreateRequest({
        contactIds: [12],
        customerId: 7,
        name: "年度续约",
        pipelineCode: "direct",
        primaryContactId: 13,
        stageCode: "discovery",
      }),
    ).not.toHaveProperty("primaryContactId");
  });

  it("sends only valid optional business fields without deriving defaults", () => {
    expect(
      toOpportunityCreateRequest({
        customerId: 7,
        description: " 年度续约讨论 ",
        estimatedAmount: 1250.5,
        expectedCloseDate: "2026-09-30",
        name: "年度续约",
        nextContactTime: "2026-08-10T09:30:00",
        pipelineCode: "direct",
        stageCode: "discovery",
      }),
    ).toMatchObject({
      description: "年度续约讨论",
      estimatedAmount: 1250.5,
      expectedCloseDate: "2026-09-30",
      nextContactTime: "2026-08-10T09:30:00",
    });

    expect(
      toOpportunityCreateRequest({
        customerId: 7,
        description: "   ",
        estimatedAmount: -1,
        expectedCloseDate: "invalid",
        name: "年度续约",
        nextContactTime: "invalid",
        pipelineCode: "direct",
        stageCode: "discovery",
      }),
    ).toEqual({
      customerId: 7,
      name: "年度续约",
      pipelineCode: "direct",
      stageCode: "discovery",
    });
  });

  it("keeps catalog-backed custom fields and only server-confirmed OPPORTUNITY draft file IDs", () => {
    expect(
      toOpportunityCreateRequest({
        customerId: 7,
        customFields: { source: [" 展会 ", "展会", ""] },
        fileFieldSubmission: {
          draftId: 31,
          fields: { agreement: [41, 41, 0, -1], empty: [] },
        },
        name: "年度续约",
        pipelineCode: "direct",
        stageCode: "discovery",
      }),
    ).toEqual({
      customerId: 7,
      customFields: { source: ["展会"] },
      fileFieldDraftId: 31,
      fileFields: { agreement: [41] },
      name: "年度续约",
      pipelineCode: "direct",
      stageCode: "discovery",
    });
  });
});

describe("toOpportunityEditableBaseline", () => {
  it("uses a complete safe baseline to preserve replacement fields and explicitly clear next contact time", () => {
    const baseline = toOpportunityEditableBaseline({
      customerId: 7,
      description: "续约讨论",
      editable: true,
      estimatedAmount: 1250.5,
      expectedCloseDate: "2026-09-30",
      id: 8,
      name: "年度续约",
      nextContactTime: "2026-08-08T09:30:00",
      pipelineCode: "direct",
      stageCode: "qualification",
      version: 3,
    });

    expect(baseline !== null && isCompleteOpportunityEditableBaseline(baseline)).toBe(true);
    if (baseline === null || !isCompleteOpportunityEditableBaseline(baseline)) {
      throw new Error("Expected a complete opportunity editable baseline.");
    }

    const values = {
      ...opportunityUpdateValuesFromBaseline(baseline),
      nextContactTime: "",
    };
    expect(toOpportunityUpdateRequest(values, baseline)).toEqual({
      customerId: 7,
      description: "续约讨论",
      estimatedAmount: 1250.5,
      expectedCloseDate: "2026-09-30",
      name: "年度续约",
      nextContactTime: null,
      pipelineCode: "direct",
      stageCode: "qualification",
      version: 3,
    });
    expect(hasOpportunityUpdateChanges(values, baseline)).toBe(true);
  });

  it("replaces customer and pipeline only with explicit complete directory selections", () => {
    const baseline = toOpportunityEditableBaseline({
      customerId: 7,
      editable: true,
      id: 8,
      name: "年度续约",
      pipelineCode: "direct",
      stageCode: "qualification",
      version: 3,
    });
    if (baseline === null || !isCompleteOpportunityEditableBaseline(baseline)) {
      throw new Error("Expected a complete opportunity editable baseline.");
    }

    const values = opportunityUpdateValuesFromBaseline(baseline);
    expect(
      toOpportunityUpdateRequest(values, baseline, {
        customerId: 12,
        pipelineStage: { pipelineCode: "partner", stageCode: "proposal" },
      }),
    ).toMatchObject({
      customerId: 12,
      pipelineCode: "partner",
      stageCode: "proposal",
    });
    expect(
      hasOpportunityUpdateChanges(values, baseline, {
        customerId: 12,
        pipelineStage: { pipelineCode: "partner", stageCode: "proposal" },
      }),
    ).toBe(true);

    expect(
      toOpportunityUpdateRequest(values, baseline, {
        customerId: -1,
        pipelineStage: { pipelineCode: "partner", stageCode: "" },
      }),
    ).toMatchObject({
      customerId: 7,
      pipelineCode: "direct",
      stageCode: "qualification",
    });
    expect(
      hasOpportunityUpdateChanges(values, baseline, {
        customerId: -1,
        pipelineStage: { pipelineCode: "partner", stageCode: "" },
      }),
    ).toBe(false);
  });

  it("rejects a non-editable baseline that leaks a business field", () => {
    expect(
      toOpportunityEditableBaseline({ editable: false, id: 8, name: "不应返回", version: 3 }),
    ).toBeNull();
  });

  it("adds only explicitly touched scalar custom fields to the safe full replacement request", () => {
    const baseline = toOpportunityEditableBaseline({
      customerId: 7,
      editable: true,
      id: 8,
      name: "年度续约",
      pipelineCode: "direct",
      stageCode: "qualification",
      version: 3,
    });
    if (baseline === null || !isCompleteOpportunityEditableBaseline(baseline)) {
      throw new Error("Expected a complete opportunity editable baseline.");
    }
    const definitions: readonly FieldDefinition[] = [
      {
        builtin: false,
        code: "source",
        displayName: "来源",
        displayOrder: 0,
        fieldType: "TEXT",
        options: [],
        required: false,
        searchable: true,
        sectionName: null,
        status: "ACTIVE",
      },
      {
        builtin: false,
        code: "attachment",
        displayName: "附件",
        displayOrder: 1,
        fieldType: "FILE",
        options: [],
        required: false,
        searchable: false,
        sectionName: null,
        status: "ACTIVE",
      },
    ];

    expect(
      toOpportunityCustomFieldUpdateRequest(
        opportunityUpdateValuesFromBaseline(baseline),
        baseline,
        definitions,
        {
          changedCodes: new Set(["source", "unknown", "attachment"]),
          customFields: { source: [" 展会 ", "展会"] },
        },
      ),
    ).toEqual({
      customFields: { source: ["展会"] },
      customerId: 7,
      description: undefined,
      estimatedAmount: undefined,
      expectedCloseDate: undefined,
      name: "年度续约",
      nextContactTime: null,
      pipelineCode: "direct",
      stageCode: "qualification",
      version: 3,
    });

    expect(
      toOpportunityCustomFieldUpdateRequest(
        opportunityUpdateValuesFromBaseline(baseline),
        baseline,
        definitions,
        { changedCodes: new Set(["source"]), customFields: {} },
      ),
    ).toMatchObject({ customFields: { source: [] } });
  });
});
