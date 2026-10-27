import { describe, expect, it } from "vitest";

import {
  toStageWorkflowConfigurationCandidatePage,
  toStageWorkflowConfigurationOptions,
  toStageWorkflowConfigurationRequest,
  toStageWorkflowEditableBaseline,
  toStageWorkflowMutationResult,
} from "./stage-workflow-configuration";

const options = {
  approvalDefinitions: [{ id: 21, name: "客户资质审批", version: 3 }],
  fields: [
    {
      blockerCode: null,
      code: "industry",
      displayName: "所属行业",
      fieldType: "SELECT",
      requiredFieldEligible: true,
      writable: true,
    },
    {
      blockerCode: "FIELD_NOT_WRITABLE",
      code: "internal-note",
      displayName: "内部备注",
      fieldType: "TEXT",
      requiredFieldEligible: false,
      writable: false,
    },
  ],
  objectTypes: [{ code: "CUSTOMER", displayName: "客户" }],
};

describe("stage workflow configuration boundaries", () => {
  it("keeps a complete server-issued editable baseline and its explicit action targets", () => {
    expect(
      toStageWorkflowEditableBaseline({
        allowedActions: ["UPDATE", "CHANGE_STATUS"],
        allowedStatuses: ["ACTIVE", "DELETED"],
        applicableActorIds: [9],
        applicableDepartmentIds: [3],
        createdTime: "2026-07-28T09:00:00Z",
        failureName: "未完成",
        id: 8,
        name: "客户资格确认",
        objectType: "CUSTOMER",
        stages: [
          {
            approvalDefinitionId: 21,
            blockerCode: null,
            code: "qualification",
            editable: true,
            name: "资格确认",
            order: 0,
            probability: 20,
            requiredFieldCodes: ["industry"],
            tasks: [{ code: "verify-owner", name: "确认负责人", required: true }],
          },
        ],
        status: "INACTIVE",
        successName: "已完成",
        updatedTime: "2026-07-28T10:00:00Z",
        version: 4,
      }),
    ).toEqual({
      allowedStatuses: ["ACTIVE", "DELETED"],
      applicableActorIds: [9],
      applicableDepartmentIds: [3],
      canChangeStatus: true,
      canUpdate: true,
      failureName: "未完成",
      id: 8,
      name: "客户资格确认",
      objectType: "CUSTOMER",
      stages: [
        {
          approvalDefinitionId: 21,
          blockerCode: null,
          code: "qualification",
          editable: true,
          name: "资格确认",
          order: 0,
          probability: 20,
          requiredFieldCodes: ["industry"],
          tasks: [{ code: "verify-owner", name: "确认负责人", required: true }],
        },
      ],
      status: "INACTIVE",
      successName: "已完成",
      version: 4,
    });
  });

  it("fails closed when any returned stage is not safely replaceable", () => {
    expect(
      toStageWorkflowEditableBaseline({
        allowedActions: ["UPDATE"],
        allowedStatuses: [],
        applicableActorIds: [],
        applicableDepartmentIds: [],
        createdTime: "2026-07-28T09:00:00Z",
        failureName: "未完成",
        id: 8,
        name: "客户资格确认",
        objectType: "CUSTOMER",
        stages: [
          {
            blockerCode: "LEGACY_STAGE",
            code: "qualification",
            editable: false,
            name: "资格确认",
            order: 0,
            probability: 20,
            requiredFieldCodes: [],
            tasks: [],
          },
        ],
        status: "INACTIVE",
        successName: "已完成",
        updatedTime: "2026-07-28T10:00:00Z",
        version: 4,
      }),
    ).toMatchObject({ canUpdate: false, stages: [{ editable: false }] });
  });

  it("accepts only typed configuration catalogs and matching candidate pages", () => {
    const catalog = toStageWorkflowConfigurationOptions(options);
    expect(catalog?.fields[0]).toMatchObject({ code: "industry", requiredFieldEligible: true });
    expect(catalog?.objectTypes[0]).toMatchObject({ code: "CUSTOMER" });
    expect(
      toStageWorkflowConfigurationCandidatePage(
        {
          objectList: [{ displayName: "王小明", id: 9, valueType: "MEMBER" }],
          pageNum: 1,
          pageSize: 50,
          totalNum: 1,
        },
        "MEMBER",
      ),
    ).toEqual({
      candidates: [{ displayName: "王小明", id: 9, valueType: "MEMBER" }],
      page: 1,
      size: 50,
      total: 1,
    });
    expect(
      toStageWorkflowConfigurationCandidatePage(
        {
          objectList: [{ displayName: "王小明", id: 9, valueType: "MEMBER" }],
          pageNum: 1,
          pageSize: 50,
          totalNum: 1,
        },
        "DEPARTMENT",
      ),
    ).toBeNull();
  });

  it("rebuilds a complete versioned request only from listed fields and approval definitions", () => {
    const catalog = toStageWorkflowConfigurationOptions(options);
    expect(catalog).not.toBeNull();
    expect(
      catalog === null
        ? null
        : toStageWorkflowConfigurationRequest(
            {
              applicableActorIds: [9],
              applicableDepartmentIds: [3],
              failureName: "未完成",
              name: "客户资格确认",
              objectType: "CUSTOMER",
              stages: [
                {
                  approvalDefinitionId: 21,
                  blockerCode: null,
                  code: "qualification",
                  editable: true,
                  name: "资格确认",
                  order: 0,
                  probability: 20,
                  requiredFieldCodes: ["industry"],
                  tasks: [{ code: "verify-owner", name: "确认负责人", required: true }],
                },
              ],
              successName: "已完成",
            },
            catalog,
            4,
          ),
    ).toEqual({
      applicableActorIds: [9],
      applicableDepartmentIds: [3],
      failureName: "未完成",
      name: "客户资格确认",
      objectType: "CUSTOMER",
      stages: [
        {
          approvalDefinitionId: 21,
          code: "qualification",
          name: "资格确认",
          order: 0,
          probability: 20,
          requiredFieldCodes: ["industry"],
          tasks: [{ code: "verify-owner", name: "确认负责人", required: true }],
        },
      ],
      successName: "已完成",
      version: 4,
    });
  });

  it("rejects a request that tries to require a non-writable catalog field", () => {
    const catalog = toStageWorkflowConfigurationOptions(options);
    expect(
      catalog === null
        ? null
        : toStageWorkflowConfigurationRequest(
            {
              applicableActorIds: [],
              applicableDepartmentIds: [],
              failureName: "未完成",
              name: "客户资格确认",
              objectType: "CUSTOMER",
              stages: [
                {
                  approvalDefinitionId: null,
                  blockerCode: null,
                  code: "qualification",
                  editable: true,
                  name: "资格确认",
                  order: 0,
                  probability: 20,
                  requiredFieldCodes: ["internal-note"],
                  tasks: [],
                },
              ],
              successName: "已完成",
            },
            catalog,
          ),
    ).toBeNull();
  });

  it("requires an exact typed workflow mutation result", () => {
    expect(toStageWorkflowMutationResult({ id: 8, status: "INACTIVE", version: 4 })).toEqual({
      id: 8,
      status: "INACTIVE",
      version: 4,
    });
    expect(toStageWorkflowMutationResult({ id: 8, status: "UNKNOWN", version: 4 })).toBeNull();
  });
});
