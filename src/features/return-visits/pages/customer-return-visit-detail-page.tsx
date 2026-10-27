import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";
import { ControlledFileFieldDownloadCard } from "~/components/controlled-file-field";
import {
  CustomFieldFormFields,
  createFieldMetadataQueryKeys,
  customFieldFormDefinitions,
  serverProvidedDynamicFields,
  ServerProvidedDynamicFieldDescriptions,
  validateCustomFieldFormValues,
  type CustomFieldValues,
} from "~/components/dynamic-field";
import { ApprovalStartAction, ApprovalStatusTag } from "~/features/approvals";

import type { ReturnVisitDetail } from "../model/return-visit-detail";
import {
  decodeReturnVisitRelationOptions,
  type ReturnVisitRelationKind,
} from "../model/return-visit-relation-option";
import {
  toReturnVisitCustomFieldUpdateRequest,
  toReturnVisitRelationUpdateRequest,
} from "../model/return-visit-form";
import { returnVisitFormLabel, returnVisitSatisfactionLabel } from "../model/return-visit-fields";
import { returnVisitKeys } from "../model/query-keys";

import styles from "./customer-return-visit-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

function displayReference(label: string, value: number | null): string {
  return value === null ? "—" : `${label} ${value}`;
}

type ReturnVisitRelationBaseline = ReturnVisitDetail & { remark: string; visitTime: string };

function isReturnVisitRelationBaseline(
  returnVisit: ReturnVisitDetail | null,
): returnVisit is ReturnVisitRelationBaseline {
  return (
    returnVisit !== null &&
    returnVisit.remark !== null &&
    returnVisit.visitTime !== null &&
    dayjs(returnVisit.visitTime).isValid()
  );
}

function relationStateIsEditable(
  returnVisit: ReturnVisitRelationBaseline,
  relation: ReturnVisitRelationKind,
): boolean {
  return relation === "contact"
    ? returnVisit.contactRelationState !== "HIDDEN"
    : returnVisit.contractRelationState !== "HIDDEN";
}

export function CustomerReturnVisitDetailPage() {
  const { customerId: customerIdParam, returnVisitId: returnVisitIdParam } = useParams();
  return (
    <CustomerReturnVisitDetailSurface
      customerId={parseRouteId(customerIdParam)}
      returnVisitId={parseRouteId(returnVisitIdParam)}
    />
  );
}

export function CustomerReturnVisitDetailSurface({
  customerId,
  returnVisitId,
  onClose,
  onEdit,
}: Readonly<{
  customerId: number | null;
  returnVisitId: number | null;
  onClose?: () => void;
  onEdit?: (customerId: number, returnVisitId: number) => void;
}>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerMemberKeyword, setOwnerMemberKeyword] = useState("");
  const [relationPicker, setRelationPicker] = useState<ReturnVisitRelationKind | null>(null);
  const [relationKeyword, setRelationKeyword] = useState("");
  const [customFieldEditorOpen, setCustomFieldEditorOpen] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [changedCustomFieldCodes, setChangedCustomFieldCodes] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [customFieldErrors, setCustomFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [customFieldMemberKeyword, setCustomFieldMemberKeyword] = useState("");
  const canReadReturnVisits = hasAuthority(authorization, authority.returnVisitsRead);
  const canReadReturnVisitFileFields =
    canReadReturnVisits && hasAuthority(authorization, authority.filesRead);
  const canReadFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canWriteReturnVisits = hasAuthority(authorization, authority.returnVisitsWrite);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const canReadContacts = hasAuthority(authorization, authority.contactsRead);
  const canReadContracts = hasAuthority(authorization, authority.contractsRead);

  function closeDetail() {
    if (onClose !== undefined) {
      onClose();
      return;
    }
    if (customerId !== null) {
      navigate(`/crm/customers/${customerId}/return-visits`, { replace: true });
      return;
    }
    navigate("/crm/return-visits", { replace: true });
  }

  const returnVisitQuery = useQuery({
    queryKey:
      returnVisitId === null
        ? returnVisitKeys.detail(identityKey, 0)
        : returnVisitKeys.detail(identityKey, returnVisitId),
    queryFn: () =>
      apiClient === null || returnVisitId === null
        ? Promise.reject(new Error("Return visit detail is unavailable."))
        : apiClient.getReturnVisit(returnVisitId),
    enabled: apiClient !== null && returnVisitId !== null && canReadReturnVisits,
  });
  const fieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "RETURN_VISIT", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回访字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("RETURN_VISIT"),
    enabled:
      apiClient !== null && returnVisitId !== null && canReadReturnVisits && canReadFieldMetadata,
  });
  const customFieldDefinitions = fieldDefinitionsQuery.data ?? [];
  const customFormFieldDefinitions = customFieldFormDefinitions(customFieldDefinitions);
  const hasMemberCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "USER",
  );
  const hasDepartmentCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "DEPARTMENT",
  );
  const customFieldMemberQuery = useQuery({
    queryKey: [
      "return-visit-detail-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回访自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled:
      apiClient !== null && customFieldEditorOpen && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["return-visit-detail-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回访自定义部门字段的部门目录暂时不可用。"))
        : apiClient.getVisibleDepartments(),
    enabled:
      apiClient !== null &&
      customFieldEditorOpen &&
      canReadOrganization &&
      hasDepartmentCustomField,
  });
  const deleteMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || returnVisitId === null
        ? Promise.reject(new Error("Return-visit deletion is unavailable."))
        : apiClient.deleteReturnVisit(returnVisitId, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: returnVisitKeys.lists(identityKey) });
      if (returnVisitId !== null) {
        queryClient.removeQueries({ queryKey: returnVisitKeys.detail(identityKey, returnVisitId) });
      }
      closeDetail();
    },
  });
  const ownerMemberQuery = useQuery({
    queryKey: ["member-selector", "return-visit-owner", identityKey, ownerMemberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Member selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: ownerMemberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && ownerPickerOpen && canReadOrganization,
  });
  const relationBaselineCandidate = returnVisitQuery.data ?? null;
  const relationBaseline: ReturnVisitRelationBaseline | null = isReturnVisitRelationBaseline(
    relationBaselineCandidate,
  )
    ? relationBaselineCandidate
    : null;
  const relationCustomerId = relationBaseline?.customerId ?? null;
  const contactRelationQuery = useQuery({
    queryKey: [
      "return-visit-relation-selector",
      "contact",
      identityKey,
      relationCustomerId,
      relationKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null || relationCustomerId === null
        ? Promise.reject(new Error("Contact selection is unavailable."))
        : apiClient
            .getContacts({
              customerId: relationCustomerId,
              keyword: relationKeyword.trim() || undefined,
              page: 1,
              size: 50,
            })
            .then((pager) => decodeReturnVisitRelationOptions(pager, relationCustomerId)),
    enabled:
      apiClient !== null &&
      relationPicker === "contact" &&
      relationBaseline !== null &&
      canReadCustomers &&
      canReadContacts,
  });
  const contractRelationQuery = useQuery({
    queryKey: [
      "return-visit-relation-selector",
      "contract",
      identityKey,
      relationCustomerId,
      relationKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null || relationCustomerId === null
        ? Promise.reject(new Error("Contract selection is unavailable."))
        : apiClient
            .getContracts({
              customerId: relationCustomerId,
              keyword: relationKeyword.trim() || undefined,
              page: 1,
              size: 50,
            })
            .then((pager) => decodeReturnVisitRelationOptions(pager, relationCustomerId)),
    enabled:
      apiClient !== null &&
      relationPicker === "contract" &&
      relationBaseline !== null &&
      canReadCustomers &&
      canReadContracts,
  });
  const ownerMutation = useMutation({
    mutationFn: ({ actorId, version }: { actorId: number; version: number }) =>
      apiClient === null || returnVisitId === null
        ? Promise.reject(new Error("Return visit owner update is unavailable."))
        : apiClient.updateReturnVisitOwner(returnVisitId, { ownerActorId: actorId, version }),
    onSuccess: (updatedReturnVisit) => {
      queryClient.setQueryData(
        returnVisitKeys.detail(identityKey, updatedReturnVisit.id),
        updatedReturnVisit,
      );
      void queryClient.invalidateQueries({ queryKey: returnVisitKeys.lists(identityKey) });
      setOwnerPickerOpen(false);
      setOwnerMemberKeyword("");
    },
  });
  const relationMutation = useMutation({
    mutationFn: ({
      relation,
      relationId,
    }: {
      relation: ReturnVisitRelationKind;
      relationId: number | null;
    }) =>
      apiClient === null || returnVisitId === null || relationBaseline === null
        ? Promise.reject(new Error("Return-visit relation update is unavailable."))
        : apiClient.updateReturnVisit(
            returnVisitId,
            toReturnVisitRelationUpdateRequest({
              baselineRemark: relationBaseline.remark,
              relation,
              relationId,
              remark: relationBaseline.remark,
              version: relationBaseline.version,
              visitTime: relationBaseline.visitTime,
            }),
          ),
    onSuccess: (updatedReturnVisit) => {
      queryClient.setQueryData(
        returnVisitKeys.detail(identityKey, updatedReturnVisit.id),
        updatedReturnVisit,
      );
      void queryClient.invalidateQueries({ queryKey: returnVisitKeys.lists(identityKey) });
      setRelationPicker(null);
      setRelationKeyword("");
    },
  });
  const customFieldUpdateMutation = useMutation({
    mutationFn: ({
      baseline,
      changedCodes,
      values,
    }: {
      baseline: ReturnVisitRelationBaseline;
      changedCodes: ReadonlySet<string>;
      values: CustomFieldValues;
    }) =>
      apiClient === null || returnVisitId === null
        ? Promise.reject(new Error("Return-visit custom-field update is unavailable."))
        : apiClient
            .updateReturnVisit(
              returnVisitId,
              toReturnVisitCustomFieldUpdateRequest(customFieldDefinitions, {
                baselineRemark: baseline.remark,
                changedCodes,
                customFields: values,
                version: baseline.version,
                visitTime: baseline.visitTime,
              }),
            )
            .then((updatedReturnVisit) => {
              if (
                updatedReturnVisit.id !== returnVisitId ||
                updatedReturnVisit.customerId !== baseline.customerId
              ) {
                throw new Error(
                  "Return-visit update response does not match the current customer.",
                );
              }
              return updatedReturnVisit;
            }),
    onSuccess: (updatedReturnVisit) => {
      queryClient.setQueryData(
        returnVisitKeys.detail(identityKey, updatedReturnVisit.id),
        updatedReturnVisit,
      );
      void queryClient.invalidateQueries({ queryKey: returnVisitKeys.lists(identityKey) });
      setChangedCustomFieldCodes(new Set());
      setCustomFieldErrors({});
      setCustomFieldValues({});
      setCustomFieldMemberKeyword("");
      setCustomFieldEditorOpen(false);
    },
  });

  if (returnVisitId === null) return <StatusPage kind="not-found" />;

  if (returnVisitQuery.isLoading) {
    return (
      <div
        aria-label="正在加载回访详情"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (returnVisitQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(returnVisitQuery.error)}
        onRetry={() => void returnVisitQuery.refetch()}
      />
    );
  }

  const returnVisit = returnVisitQuery.data;
  if (returnVisit === undefined) return <StatusPage kind="unavailable" />;
  if (customerId !== null && returnVisit.customerId !== customerId) {
    return <StatusPage kind="not-found" />;
  }
  const returnVisitDynamicFields = serverProvidedDynamicFields(
    fieldDefinitionsQuery.data ?? [],
    returnVisit.customFields,
  );

  function closeOwnerPicker() {
    if (ownerMutation.isPending) return;
    ownerMutation.reset();
    setOwnerPickerOpen(false);
    setOwnerMemberKeyword("");
  }

  function openRelationPicker(relation: ReturnVisitRelationKind) {
    relationMutation.reset();
    setRelationKeyword("");
    setRelationPicker(relation);
  }

  function closeRelationPicker() {
    if (relationMutation.isPending) return;
    relationMutation.reset();
    setRelationPicker(null);
    setRelationKeyword("");
  }

  function closeCustomFieldEditor() {
    if (customFieldUpdateMutation.isPending) return;
    customFieldUpdateMutation.reset();
    setChangedCustomFieldCodes(new Set());
    setCustomFieldErrors({});
    setCustomFieldValues({});
    setCustomFieldMemberKeyword("");
    setCustomFieldEditorOpen(false);
  }

  const contactRelationEditable =
    relationBaseline !== null && relationStateIsEditable(relationBaseline, "contact");
  const contractRelationEditable =
    relationBaseline !== null && relationStateIsEditable(relationBaseline, "contract");
  const selectedRelationId =
    relationPicker === "contact" ? returnVisit.contactId : returnVisit.contractId;
  const activeRelationQuery =
    relationPicker === "contact" ? contactRelationQuery : contractRelationQuery;

  return (
    <RouteAuthority authority={authority.returnVisitsRead}>
      <>
        <main className={styles.page}>
          <section className={styles.heading}>
            <div>
              <Space>
                <Button icon={<ArrowLeftOutlined />} type="link" onClick={closeDetail}>
                  {onClose === undefined ? "返回客户回访" : "返回回访列表"}
                </Button>
                <ActionAuthority authority={authority.returnVisitsWrite}>
                  <Button
                    onClick={() => {
                      if (onEdit !== undefined) {
                        onEdit(returnVisit.customerId, returnVisitId);
                        return;
                      }
                      navigate(
                        `/crm/customers/${returnVisit.customerId}/return-visits/${returnVisitId}/edit`,
                      );
                    }}
                  >
                    编辑回访
                  </Button>
                </ActionAuthority>
                <ActionAuthority authority={authority.returnVisitsWrite}>
                  <ActionAuthority authority={authority.fieldsRead}>
                    {relationBaseline !== null &&
                    !fieldDefinitionsQuery.isError &&
                    customFormFieldDefinitions.length > 0 ? (
                      <Button
                        onClick={() => {
                          customFieldUpdateMutation.reset();
                          setChangedCustomFieldCodes(new Set());
                          setCustomFieldErrors({});
                          setCustomFieldValues({});
                          setCustomFieldMemberKeyword("");
                          setCustomFieldEditorOpen(true);
                        }}
                      >
                        编辑自定义字段
                      </Button>
                    ) : null}
                  </ActionAuthority>
                </ActionAuthority>
                <ActionAuthority authority={authority.returnVisitsWrite}>
                  <ActionAuthority authority={authority.contactsRead}>
                    <ActionAuthority authority={authority.customersRead}>
                      {contactRelationEditable &&
                      canWriteReturnVisits &&
                      canReadContacts &&
                      canReadCustomers ? (
                        <Button onClick={() => openRelationPicker("contact")}>
                          {returnVisit.contactId === null ? "选择联系人" : "更换联系人"}
                        </Button>
                      ) : null}
                    </ActionAuthority>
                  </ActionAuthority>
                </ActionAuthority>
                <ActionAuthority authority={authority.returnVisitsWrite}>
                  <ActionAuthority authority={authority.contractsRead}>
                    <ActionAuthority authority={authority.customersRead}>
                      {contractRelationEditable &&
                      canWriteReturnVisits &&
                      canReadContracts &&
                      canReadCustomers ? (
                        <Button onClick={() => openRelationPicker("contract")}>
                          {returnVisit.contractId === null ? "选择合同" : "更换合同"}
                        </Button>
                      ) : null}
                    </ActionAuthority>
                  </ActionAuthority>
                </ActionAuthority>
                <ActionAuthority authority={authority.returnVisitsAssign}>
                  <ActionAuthority authority={authority.organizationRead}>
                    <Button
                      onClick={() => {
                        ownerMutation.reset();
                        setOwnerPickerOpen(true);
                      }}
                    >
                      变更负责人
                    </Button>
                  </ActionAuthority>
                </ActionAuthority>
                <ActionAuthority authority={authority.returnVisitsDelete}>
                  <Popconfirm
                    cancelText="取消"
                    description="删除后回访会进入服务端软删除状态，并撤回其附件和文件字段绑定。"
                    okButtonProps={{ danger: true }}
                    okText="确认删除"
                    title="确认删除这条回访？"
                    onConfirm={() => deleteMutation.mutate(returnVisit.version)}
                  >
                    <Button
                      danger
                      disabled={deleteMutation.isPending}
                      loading={deleteMutation.isPending}
                    >
                      删除回访
                    </Button>
                  </Popconfirm>
                </ActionAuthority>
                <ApprovalStartAction
                  objectType="RETURN_VISIT"
                  subjectId={returnVisit.id}
                  onStarted={() => {
                    void queryClient.invalidateQueries({
                      queryKey: returnVisitKeys.detail(identityKey, returnVisit.id),
                    });
                    void queryClient.invalidateQueries({
                      queryKey: returnVisitKeys.lists(identityKey),
                    });
                  }}
                />
              </Space>
              <Typography.Title level={2}>回访详情</Typography.Title>
              <Typography.Text strong>
                {returnVisit.visitNumber || `回访 ${returnVisit.id}`}
              </Typography.Text>
              <Typography.Text type="secondary">
                基础字段以服务端当前返回为准；关联对象可见性和字段遮罩不会由浏览器补全。
              </Typography.Text>
            </div>
          </section>
          {deleteMutation.isError ? (
            <Alert
              title={
                deleteMutation.error instanceof ApiError
                  ? deleteMutation.error.message
                  : "回访暂时无法删除"
              }
              showIcon
              type="error"
            />
          ) : null}
          <Card title="基本信息">
            <Descriptions
              column={{ xs: 1, sm: 2, lg: 3 }}
              items={[
                {
                  key: "id",
                  label: "回访编号",
                  children: returnVisit.visitNumber ?? returnVisit.id,
                },
                {
                  key: "customer",
                  label: "关联客户",
                  children: displayReference("客户", returnVisit.customerId),
                },
                {
                  key: "contact",
                  label: "联系人",
                  children: displayReference("联系人", returnVisit.contactId),
                },
                {
                  key: "contract",
                  label: "合同",
                  children: displayReference("合同", returnVisit.contractId),
                },
                {
                  key: "owner",
                  label: "负责人",
                  children: displayReference("成员", returnVisit.ownerActorId),
                },
                { key: "time", label: "回访时间", children: returnVisit.visitTime ?? "—" },
                {
                  key: "visit-form",
                  label: "回访形式",
                  children: returnVisitFormLabel(returnVisit.visitForm),
                },
                {
                  key: "satisfaction",
                  label: "客户满意度",
                  children: returnVisitSatisfactionLabel(returnVisit.satisfaction),
                },
                {
                  key: "status",
                  label: "记录状态",
                  children: returnVisit.status === null ? "—" : <Tag>{returnVisit.status}</Tag>,
                },
                {
                  key: "approval-status",
                  label: "审批状态",
                  children: <ApprovalStatusTag status={returnVisit.approvalStatus} />,
                },
                { key: "created", label: "创建时间", children: returnVisit.createdTime ?? "—" },
                { key: "updated", label: "更新时间", children: returnVisit.updatedTime ?? "—" },
              ]}
            />
          </Card>
          {canReadFieldMetadata && fieldDefinitionsQuery.isLoading ? (
            <Card title="自定义字段">
              <Spin aria-label="正在加载回访自定义字段目录" />
            </Card>
          ) : null}
          {canReadFieldMetadata && fieldDefinitionsQuery.isError ? (
            <Card title="自定义字段">
              <Alert title="回访自定义字段目录暂时无法加载" showIcon type="error" />
            </Card>
          ) : null}
          {returnVisitDynamicFields.length > 0 ? (
            <Card title="自定义字段">
              <Typography.Paragraph type="secondary">
                值仅按服务端当前返回展示；不会作为编辑或字段权限判断的依据。
              </Typography.Paragraph>
              <ServerProvidedDynamicFieldDescriptions
                columns={{ lg: 3, sm: 2, xs: 1 }}
                definitions={fieldDefinitionsQuery.data ?? []}
                values={returnVisit.customFields}
              />
            </Card>
          ) : null}
          <ControlledFileFieldDownloadCard
            canRead={canReadReturnVisitFileFields}
            fileFields={returnVisit.fileFields ?? []}
            targetId={returnVisit.id}
            targetType="return-visit"
            title="回访字段附件"
          />
          <Card title="客户反馈">
            <Typography.Paragraph className={styles.remark}>
              {returnVisit.remark || "暂无客户反馈"}
            </Typography.Paragraph>
          </Card>
        </main>
        <Modal
          destroyOnHidden
          footer={
            <Space>
              <Button
                disabled={customFieldUpdateMutation.isPending}
                onClick={closeCustomFieldEditor}
              >
                取消
              </Button>
              <Button
                disabled={
                  fieldDefinitionsQuery.isError ||
                  relationBaseline === null ||
                  changedCustomFieldCodes.size === 0
                }
                loading={customFieldUpdateMutation.isPending}
                type="primary"
                onClick={() => {
                  if (relationBaseline === null) return;
                  const customFieldIssues = validateCustomFieldFormValues(
                    customFieldDefinitions,
                    customFieldValues,
                  ).filter((issue) => changedCustomFieldCodes.has(issue.code));
                  setCustomFieldErrors(
                    Object.fromEntries(
                      customFieldIssues.map((issue) => [issue.code, issue.message]),
                    ),
                  );
                  if (customFieldIssues.length > 0) return;
                  customFieldUpdateMutation.mutate({
                    baseline: relationBaseline,
                    changedCodes: changedCustomFieldCodes,
                    values: customFieldValues,
                  });
                }}
              >
                保存修改
              </Button>
            </Space>
          }
          open={customFieldEditorOpen}
          title="编辑自定义字段"
          onCancel={closeCustomFieldEditor}
        >
          <Typography.Paragraph type="secondary">
            为避免把详情中的脱敏或只读值写回，字段均从空白开始。只有本次明确填写或清除的字段会提交；未操作字段由服务端保持当前值。保存会原样保留当前已安全回显的回访时间和反馈。
          </Typography.Paragraph>
          {fieldDefinitionsQuery.isError ? (
            <Alert title="回访自定义字段目录暂时无法加载" showIcon type="warning" />
          ) : (
            <Form layout="vertical">
              <CustomFieldFormFields
                definitions={customFieldDefinitions}
                departmentOptions={customFieldDepartmentQuery.data ?? []}
                disabled={customFieldUpdateMutation.isPending}
                errors={customFieldErrors}
                memberOptions={customFieldMemberQuery.data ?? []}
                memberOptionsLoading={customFieldMemberQuery.isLoading}
                showExplicitClear
                values={customFieldValues}
                onChange={setCustomFieldValues}
                onFieldChange={(code) => {
                  setChangedCustomFieldCodes((current) => new Set(current).add(code));
                  setCustomFieldErrors((current) => {
                    if (current[code] === undefined) return current;
                    return Object.fromEntries(
                      Object.entries(current).filter(([currentCode]) => currentCode !== code),
                    );
                  });
                }}
                onMemberSearch={setCustomFieldMemberKeyword}
              />
            </Form>
          )}
          {hasMemberCustomField && customFieldMemberQuery.isError ? (
            <Alert
              title="自定义人员字段候选暂时无法加载；请稍后重试后再修改该类字段"
              showIcon
              type="warning"
            />
          ) : null}
          {hasDepartmentCustomField && customFieldDepartmentQuery.isError ? (
            <Alert
              title="自定义部门字段候选暂时无法加载；请稍后重试后再修改该类字段"
              showIcon
              type="warning"
            />
          ) : null}
          {customFieldUpdateMutation.isError ? (
            <Alert
              title={
                customFieldUpdateMutation.error instanceof ApiError
                  ? customFieldUpdateMutation.error.message
                  : "回访自定义字段暂时无法更新"
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
        </Modal>
        <Modal
          destroyOnHidden
          footer={null}
          open={ownerPickerOpen}
          title="变更负责人"
          onCancel={closeOwnerPicker}
        >
          <Typography.Paragraph type="secondary">
            仅显示服务端允许当前成员查看的在职成员；最终可分配范围、字段权限和并发均由服务端校验。
          </Typography.Paragraph>
          <Input.Search
            allowClear
            defaultValue={ownerMemberKeyword}
            placeholder="按成员姓名搜索"
            style={{ marginTop: 12 }}
            onSearch={(keyword) => setOwnerMemberKeyword(keyword)}
          />
          {ownerMemberQuery.isError ? (
            <Alert title="成员列表暂时无法加载" showIcon type="error" />
          ) : (
            <List
              dataSource={[...(ownerMemberQuery.data ?? [])]}
              loading={ownerMemberQuery.isLoading}
              locale={{ emptyText: "未找到可选择成员" }}
              renderItem={(member) => (
                <List.Item
                  actions={[
                    <Button
                      disabled={
                        ownerMutation.isPending || member.actorId === returnVisit.ownerActorId
                      }
                      key={member.actorId}
                      loading={ownerMutation.isPending}
                      type="link"
                      onClick={() =>
                        ownerMutation.mutate({
                          actorId: member.actorId,
                          version: returnVisit.version,
                        })
                      }
                    >
                      {member.actorId === returnVisit.ownerActorId ? "当前负责人" : "选择"}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    description={`成员 ${member.actorId}`}
                    title={member.displayName}
                  />
                </List.Item>
              )}
            />
          )}
          {ownerMutation.isError ? (
            <Alert
              title={
                ownerMutation.error instanceof ApiError
                  ? ownerMutation.error.message
                  : "回访负责人暂时无法更新"
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
        </Modal>
        <Modal
          destroyOnHidden
          footer={null}
          open={relationPicker !== null}
          title={relationPicker === "contact" ? "选择联系人" : "选择合同"}
          onCancel={closeRelationPicker}
        >
          <Typography.Paragraph type="secondary">
            仅显示服务端允许查看、且明确属于当前客户的候选项。选择会携带当前
            version；服务端会再次校验关联归属、字段写入权限和并发。清除只在明确确认后发送当前关系的
            `null`，不会改写另一个关系。
          </Typography.Paragraph>
          {relationPicker !== null && selectedRelationId !== null ? (
            <Popconfirm
              cancelText="取消"
              okText="清除"
              title={`确认清除当前${relationPicker === "contact" ? "联系人" : "合同"}关联吗？`}
              onConfirm={() =>
                relationMutation.mutate({ relation: relationPicker, relationId: null })
              }
            >
              <Button
                danger
                disabled={relationMutation.isPending}
                loading={relationMutation.isPending}
                style={{ marginBottom: 12 }}
              >
                清除当前{relationPicker === "contact" ? "联系人" : "合同"}（{selectedRelationId}）
              </Button>
            </Popconfirm>
          ) : null}
          <Input.Search
            allowClear
            defaultValue={relationKeyword}
            key={relationPicker}
            placeholder={relationPicker === "contact" ? "按联系人姓名搜索" : "按合同名称搜索"}
            style={{ marginTop: 12 }}
            onSearch={(keyword) => setRelationKeyword(keyword)}
          />
          {activeRelationQuery.isError ? (
            <Alert
              title={
                relationPicker === "contact" ? "联系人列表暂时无法加载" : "合同列表暂时无法加载"
              }
              showIcon
              type="error"
            />
          ) : (
            <List
              dataSource={[...(activeRelationQuery.data ?? [])]}
              loading={activeRelationQuery.isLoading}
              locale={{ emptyText: "未找到可选择项" }}
              renderItem={(option) => (
                <List.Item
                  actions={[
                    <Button
                      disabled={relationMutation.isPending || option.id === selectedRelationId}
                      key={option.id}
                      loading={relationMutation.isPending}
                      type="link"
                      onClick={() =>
                        relationPicker === null
                          ? undefined
                          : relationMutation.mutate({
                              relation: relationPicker,
                              relationId: option.id,
                            })
                      }
                    >
                      {option.id === selectedRelationId ? "当前关联" : "选择"}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    description={`${relationPicker === "contact" ? "联系人" : "合同"} ${option.id}`}
                    title={option.name}
                  />
                </List.Item>
              )}
            />
          )}
          {relationMutation.isError ? (
            <Alert
              title={
                relationMutation.error instanceof ApiError
                  ? relationMutation.error.message
                  : "回访关联暂时无法更新"
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
        </Modal>
      </>
    </RouteAuthority>
  );
}
