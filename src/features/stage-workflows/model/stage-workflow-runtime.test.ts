import { describe, expect, it } from "vitest";

import {
  toStageWorkflowActionRecord,
  toStageWorkflowApplicableOptions,
  toStageWorkflowRecord,
} from "./stage-workflow-runtime";

describe("stage workflow runtime projections", () => {
  it("keeps only server-confirmed applicable workflows and their canStart capability", () => {
    expect(
      toStageWorkflowApplicableOptions({
        objectType: "CUSTOMER",
        recordId: 8,
        workflows: [
          { blockerCode: null, canStart: true, name: "客户资格确认", workflowId: 18 },
          {
            blockerCode: "WORKFLOW_ALREADY_RUNNING",
            canStart: false,
            name: "客户签约",
            workflowId: 19,
          },
        ],
      }),
    ).toEqual({
      objectType: "CUSTOMER",
      recordId: 8,
      workflows: [
        { blockerCode: null, canStart: true, name: "客户资格确认", workflowId: 18 },
        {
          blockerCode: "WORKFLOW_ALREADY_RUNNING",
          canStart: false,
          name: "客户签约",
          workflowId: 19,
        },
      ],
    });
  });

  it("keeps only safe advance-field/action projections and drops unrelated runtime data", () => {
    expect(
      toStageWorkflowRecord({
        allowedActions: ["ADVANCE", "COMMENT"],
        allowedTaskCodes: [],
        approvalGate: { approvalInstanceId: 55, approverSelections: [], status: "PENDING" },
        currentStage: {
          code: "qualification",
          name: "资格确认",
          order: 1,
          tasks: [{ code: "verify-owner", name: "确认负责人", required: true }],
        },
        id: 71,
        objectType: "CUSTOMER",
        outcomeRemark: "内部备注",
        recordId: 8,
        status: "AWAITING_APPROVAL",
        version: 3,
        writableFieldCodes: ["industry"],
        workflowId: 18,
        writableFields: [
          {
            allowedValues: [{ label: "科技", value: "technology" }],
            currentValues: ["technology"],
            displayName: "所属行业",
            fieldCode: "industry",
            fieldType: "SELECT",
            input: {
              addressParts: [],
              candidatesRequired: false,
              fileDraftRequired: false,
              inputType: "OPTION_VALUES",
              supported: true,
            },
            masked: false,
            required: true,
          },
        ],
      }),
    ).toEqual({
      advanceAddressFields: [],
      advanceCandidateFields: [],
      advanceFields: [
        {
          allowedValues: [{ label: "科技", value: "technology" }],
          currentValues: ["technology"],
          displayName: "所属行业",
          fieldCode: "industry",
          fieldType: "SELECT",
          required: true,
        },
      ],
      advanceFileFields: [],
      advanceSelections: [],
      advanceTasks: [],
      canAdvanceWithFields: true,
      canAdvanceWithoutInput: false,
      canAdvanceWithSelections: false,
      canAdvanceWithTasks: false,
      canComment: true,
      canFail: false,
      currentStage: {
        name: "资格确认",
        order: 1,
        tasks: [{ name: "确认负责人", required: true }],
      },
      hasApprovalGate: true,
      hasUnsupportedAdvanceFields: false,
      id: 71,
      objectType: "CUSTOMER",
      outcomes: [],
      recordId: 8,
      status: "AWAITING_APPROVAL",
      version: 3,
      workflowId: 18,
    });
  });

  it("fails closed when a running record lacks its current stage", () => {
    expect(
      toStageWorkflowRecord({
        allowedActions: [],
        allowedTaskCodes: [],
        id: 71,
        objectType: "CUSTOMER",
        recordId: 8,
        status: "ACTIVE",
        writableFieldCodes: [],
        workflowId: 18,
        writableFields: [],
      }),
    ).toBeNull();
    expect(
      toStageWorkflowApplicableOptions({
        objectType: "CUSTOMER",
        recordId: 8,
        workflows: [{ blockerCode: 42, canStart: true, name: "客户资格确认", workflowId: 18 }],
      }),
    ).toBeNull();
  });

  it("exposes ADVANCE only for a versioned stage without unhandled input requirements", () => {
    expect(
      toStageWorkflowActionRecord({
        record: {
          allowedActions: ["ADVANCE"],
          allowedTaskCodes: [],
          currentStage: { name: "资格确认", order: 1, tasks: [] },
          id: 71,
          objectType: "CUSTOMER",
          recordId: 8,
          status: "ACTIVE",
          version: 3,
          workflowId: 18,
          writableFieldCodes: [],
          writableFields: [],
        },
      }),
    ).toMatchObject({
      advanceSelections: [],
      advanceTasks: [],
      advanceFields: [],
      canAdvanceWithFields: false,
      canAdvanceWithoutInput: true,
      canAdvanceWithSelections: false,
      canAdvanceWithTasks: false,
      id: 71,
      version: 3,
    });
    expect(
      toStageWorkflowRecord({
        allowedActions: ["ADVANCE"],
        allowedTaskCodes: ["confirm-owner"],
        currentStage: {
          name: "资格确认",
          order: 1,
          tasks: [{ code: "confirm-owner", name: "确认负责人", required: true }],
        },
        id: 71,
        objectType: "CUSTOMER",
        recordId: 8,
        status: "ACTIVE",
        version: 3,
        workflowId: 18,
        writableFieldCodes: [],
        writableFields: [],
      }),
    ).toMatchObject({
      advanceTasks: [{ code: "confirm-owner", name: "确认负责人", required: true }],
      canAdvanceWithoutInput: false,
      canAdvanceWithSelections: false,
      canAdvanceWithTasks: true,
    });
  });

  it("keeps only server-issued approval selections for an otherwise input-free advance", () => {
    expect(
      toStageWorkflowRecord({
        allowedActions: ["ADVANCE"],
        allowedTaskCodes: [],
        approvalGate: {
          approverSelections: [{ code: "manager", name: "选择审批人" }],
          status: "READY",
        },
        currentStage: { name: "资格确认", order: 1, tasks: [] },
        id: 71,
        objectType: "CUSTOMER",
        recordId: 8,
        status: "ACTIVE",
        version: 3,
        workflowId: 18,
        writableFieldCodes: [],
        writableFields: [],
      }),
    ).toMatchObject({
      advanceSelections: [{ code: "manager", name: "选择审批人" }],
      advanceTasks: [],
      advanceFields: [],
      canAdvanceWithFields: false,
      canAdvanceWithoutInput: false,
      canAdvanceWithSelections: true,
      canAdvanceWithTasks: false,
    });
  });

  it("fails closed when a writable field needs a specialized input flow", () => {
    expect(
      toStageWorkflowRecord({
        allowedActions: ["ADVANCE"],
        allowedTaskCodes: [],
        currentStage: { name: "资格确认", order: 1, tasks: [] },
        id: 71,
        objectType: "CUSTOMER",
        recordId: 8,
        status: "ACTIVE",
        version: 3,
        workflowId: 18,
        writableFieldCodes: ["evidence"],
        writableFields: [
          {
            allowedValues: [],
            currentValues: [],
            displayName: "凭证",
            fieldCode: "evidence",
            fieldType: "FILE",
            masked: false,
            required: true,
          },
        ],
      }),
    ).toMatchObject({
      advanceFields: [],
      canAdvanceWithFields: false,
      hasUnsupportedAdvanceFields: true,
    });
  });

  it("exposes FAIL only with a current server-issued outcome baseline", () => {
    expect(
      toStageWorkflowRecord({
        allowedActions: ["FAIL"],
        allowedOutcomes: [
          { code: "FAILED", label: "未完成", remarkMaxLength: 200, remarkRequired: true },
        ],
        allowedTaskCodes: [],
        currentStage: { name: "资格确认", order: 1, tasks: [] },
        id: 71,
        objectType: "CUSTOMER",
        recordId: 8,
        status: "ACTIVE",
        version: 3,
        workflowId: 18,
        writableFieldCodes: [],
        writableFields: [],
      }),
    ).toMatchObject({
      canFail: true,
      outcomes: [{ code: "FAILED", label: "未完成", remarkMaxLength: 200, remarkRequired: true }],
    });
    expect(
      toStageWorkflowRecord({
        allowedActions: ["FAIL"],
        allowedTaskCodes: [],
        currentStage: { name: "资格确认", order: 1, tasks: [] },
        id: 71,
        objectType: "CUSTOMER",
        recordId: 8,
        status: "ACTIVE",
        version: 3,
        workflowId: 18,
        writableFieldCodes: [],
        writableFields: [],
      }),
    ).toBeNull();
  });

  it("keeps record-scoped candidate fields only when their typed input baseline matches", () => {
    expect(
      toStageWorkflowRecord({
        allowedActions: ["ADVANCE"],
        allowedTaskCodes: [],
        currentStage: { name: "资格确认", order: 1, tasks: [] },
        id: 71,
        objectType: "CUSTOMER",
        recordId: 8,
        status: "ACTIVE",
        version: 3,
        workflowId: 18,
        writableFieldCodes: ["owner"],
        writableFields: [
          {
            allowedValues: [],
            currentValues: ["12"],
            displayName: "负责人",
            fieldCode: "owner",
            fieldType: "USER",
            input: {
              addressParts: [],
              candidatesRequired: true,
              fileDraftRequired: false,
              inputType: "ACTOR_IDS",
              supported: true,
            },
            masked: false,
            required: true,
          },
        ],
      }),
    ).toMatchObject({
      advanceCandidateFields: [
        { currentIds: [12], displayName: "负责人", fieldCode: "owner", fieldType: "USER" },
      ],
      canAdvanceWithFields: true,
      hasUnsupportedAdvanceFields: false,
    });
  });

  it("keeps typed ADDRESS and one FILE field only with complete server input baselines", () => {
    expect(
      toStageWorkflowRecord({
        allowedActions: ["ADVANCE"],
        allowedTaskCodes: [],
        currentStage: { name: "资格确认", order: 1, tasks: [] },
        id: 71,
        objectType: "CUSTOMER",
        recordId: 8,
        status: "ACTIVE",
        version: 3,
        workflowId: 18,
        writableFieldCodes: ["registered-address", "evidence"],
        writableFields: [
          {
            allowedValues: [],
            currentAddress: {
              addressLine: "上海市浦东新区张江路 1 号",
              city: "上海市",
              country: "中国",
              postalCode: "201203",
            },
            currentValues: [],
            displayName: "注册地址",
            fieldCode: "registered-address",
            fieldType: "ADDRESS",
            input: {
              addressParts: [
                { code: "country", displayName: "国家", maxLength: 80, required: true },
                { code: "city", displayName: "城市", maxLength: 80, required: true },
                { code: "postalCode", displayName: "邮编", maxLength: 20, required: false },
                { code: "addressLine", displayName: "详细地址", maxLength: 200, required: true },
              ],
              candidatesRequired: false,
              fileDraftRequired: false,
              inputType: "ADDRESS",
              supported: true,
            },
            masked: false,
            required: true,
          },
          {
            allowedValues: [],
            currentValues: [],
            displayName: "签约凭证",
            fieldCode: "evidence",
            fieldType: "FILE",
            input: {
              addressParts: [],
              candidatesRequired: false,
              fileDraftRequired: true,
              inputType: "FILE_DRAFT",
              supported: true,
            },
            masked: false,
            required: true,
          },
        ],
      }),
    ).toMatchObject({
      advanceAddressFields: [
        {
          currentAddress: {
            addressLine: "上海市浦东新区张江路 1 号",
            city: "上海市",
            country: "中国",
            postalCode: "201203",
          },
          displayName: "注册地址",
          fieldCode: "registered-address",
        },
      ],
      advanceFileFields: [{ displayName: "签约凭证", fieldCode: "evidence", required: true }],
      canAdvanceWithFields: true,
      hasUnsupportedAdvanceFields: false,
    });
  });

  it("fails closed when a FILE baseline would require more than one record-scoped draft", () => {
    expect(
      toStageWorkflowRecord({
        allowedActions: ["ADVANCE"],
        allowedTaskCodes: [],
        currentStage: { name: "资格确认", order: 1, tasks: [] },
        id: 71,
        objectType: "CUSTOMER",
        recordId: 8,
        status: "ACTIVE",
        version: 3,
        workflowId: 18,
        writableFieldCodes: ["evidence-a", "evidence-b"],
        writableFields: ["evidence-a", "evidence-b"].map((fieldCode) => ({
          allowedValues: [],
          currentValues: [],
          displayName: fieldCode,
          fieldCode,
          fieldType: "FILE",
          input: {
            addressParts: [],
            candidatesRequired: false,
            fileDraftRequired: true,
            inputType: "FILE_DRAFT",
            supported: true,
          },
          masked: false,
          required: true,
        })),
      }),
    ).toMatchObject({
      advanceFileFields: [],
      canAdvanceWithFields: false,
      hasUnsupportedAdvanceFields: true,
    });
  });
});
