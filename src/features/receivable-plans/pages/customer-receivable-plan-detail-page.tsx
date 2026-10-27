import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
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
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";
import { customerContextGlobalListPath } from "~/components/entity-selector/customer-context-create-route";
import { ActivityTimelineCard } from "~/features/activities";
import { ApprovalStartAction } from "~/features/approvals";
import {
  toReceivablePlanCustomFieldUpdateRequest,
  toReceivablePlanDueDateUpdateRequest,
} from "../model/receivable-plan-form";
import { receivablePlanKeys } from "../model/query-keys";
import styles from "./customer-receivable-plan-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

function installment(value: number | null, planId: number) {
  return value === null ? `回款计划 ${planId}` : `第 ${value} 期`;
}
function reference(value: number | null) {
  return value === null ? "—" : `合同 ${value}`;
}

export function CustomerReceivablePlanDetailPage() {
  const { customerId: customerParam, planId: planParam } = useParams();
  const customerId = parseRouteId(customerParam);
  const planId = parseRouteId(planParam);
  const { apiClient, authorization } = useBootstrap();
  const { state } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [dueDateEditorOpen, setDueDateEditorOpen] = useState(false);
  const [editedDueDate, setEditedDueDate] = useState("");
  const [customFieldEditorOpen, setCustomFieldEditorOpen] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [changedCustomFieldCodes, setChangedCustomFieldCodes] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [customFieldErrors, setCustomFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [customFieldMemberKeyword, setCustomFieldMemberKeyword] = useState("");
  const identityKey = state?.identityKey ?? "pending";
  const globalReturnPath = customerContextGlobalListPath(
    "/crm/receivable-plans",
    searchParams.toString(),
  );
  const returnPath = globalReturnPath ?? `/crm/customers/${customerId ?? ""}/receivable-plans`;
  const returnLabel = globalReturnPath === null ? "返回客户回款计划" : "返回回款计划管理";
  const readable =
    hasAuthority(authorization, authority.receivablePlansRead) &&
    hasAuthority(authorization, authority.customersRead);
  const canReadFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canReadFileFields = readable && hasAuthority(authorization, authority.filesRead);
  const query = useQuery({
    queryKey: receivablePlanKeys.detail(identityKey, planId ?? 0),
    queryFn: () =>
      apiClient === null || planId === null
        ? Promise.reject(new Error("回款计划详情暂时不可用。"))
        : apiClient.getReceivablePlan(planId),
    enabled: apiClient !== null && customerId !== null && planId !== null && readable,
  });
  const fieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "RECEIVABLE_PLAN", "fields:read")
      .definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回款计划字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("RECEIVABLE_PLAN"),
    enabled:
      apiClient !== null &&
      customerId !== null &&
      planId !== null &&
      readable &&
      canReadFieldMetadata,
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
      "receivable-plan-detail-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回款计划自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled:
      apiClient !== null && customFieldEditorOpen && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["receivable-plan-detail-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回款计划自定义部门字段的部门目录暂时不可用。"))
        : apiClient.getVisibleDepartments(),
    enabled:
      apiClient !== null &&
      customFieldEditorOpen &&
      canReadOrganization &&
      hasDepartmentCustomField,
  });
  const deleteMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || planId === null
        ? Promise.reject(new Error("Receivable plan deletion is unavailable."))
        : apiClient.deleteReceivablePlan(planId, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: receivablePlanKeys.lists(identityKey) });
      navigate(returnPath, { replace: true });
    },
  });
  const dueDateUpdateMutation = useMutation({
    mutationFn: ({
      dueDate,
      originalDueDate,
      version,
    }: {
      dueDate: string;
      originalDueDate: string;
      version: number;
    }) =>
      apiClient === null || planId === null || customerId === null
        ? Promise.reject(new Error("Receivable-plan update is unavailable."))
        : apiClient
            .updateReceivablePlan(
              planId,
              toReceivablePlanDueDateUpdateRequest({ dueDate, originalDueDate, version }),
            )
            .then((updatedPlan) => {
              if (updatedPlan.id !== planId || updatedPlan.customerId !== customerId) {
                throw new Error(
                  "Receivable-plan update response does not match the current customer.",
                );
              }
              return updatedPlan;
            }),
    onSuccess: (updatedPlan) => {
      queryClient.setQueryData(receivablePlanKeys.detail(identityKey, updatedPlan.id), updatedPlan);
      void queryClient.invalidateQueries({ queryKey: receivablePlanKeys.lists(identityKey) });
      setDueDateEditorOpen(false);
      setEditedDueDate("");
    },
  });
  const customFieldUpdateMutation = useMutation({
    mutationFn: ({
      changedCodes,
      values,
      version,
    }: {
      changedCodes: ReadonlySet<string>;
      values: CustomFieldValues;
      version: number;
    }) =>
      apiClient === null || planId === null || customerId === null
        ? Promise.reject(new Error("Receivable-plan custom-field update is unavailable."))
        : apiClient
            .updateReceivablePlan(
              planId,
              toReceivablePlanCustomFieldUpdateRequest(
                customFieldDefinitions,
                values,
                changedCodes,
                version,
              ),
            )
            .then((updatedPlan) => {
              if (updatedPlan.id !== planId || updatedPlan.customerId !== customerId) {
                throw new Error(
                  "Receivable-plan update response does not match the current customer.",
                );
              }
              return updatedPlan;
            }),
    onSuccess: (updatedPlan) => {
      queryClient.setQueryData(receivablePlanKeys.detail(identityKey, updatedPlan.id), updatedPlan);
      void queryClient.invalidateQueries({ queryKey: receivablePlanKeys.lists(identityKey) });
      setChangedCustomFieldCodes(new Set());
      setCustomFieldErrors({});
      setCustomFieldValues({});
      setCustomFieldMemberKeyword("");
      setCustomFieldEditorOpen(false);
    },
  });

  function closeDueDateEditor() {
    if (dueDateUpdateMutation.isPending) return;
    dueDateUpdateMutation.reset();
    setDueDateEditorOpen(false);
    setEditedDueDate("");
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
  if (customerId === null || planId === null) return <StatusPage kind="not-found" />;
  let content: ReactNode;
  if (query.isLoading)
    content = (
      <div
        aria-label="正在加载回款计划详情"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  else if (query.isError)
    content = (
      <StatusPage kind={statusKindFromError(query.error)} onRetry={() => void query.refetch()} />
    );
  else {
    const plan = query.data;
    const planDynamicFields = serverProvidedDynamicFields(
      fieldDefinitionsQuery.data ?? [],
      plan?.customFields,
    );
    const normalizedEditedDueDate = editedDueDate.trim();
    const canEditDueDate = plan !== undefined && plan.dueDate !== null;
    const canSaveDueDate =
      plan !== undefined &&
      canEditDueDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(normalizedEditedDueDate) &&
      normalizedEditedDueDate !== plan.dueDate;
    content =
      plan === undefined || plan.customerId !== customerId ? (
        <StatusPage kind="not-found" />
      ) : (
        <main className={styles.page}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(returnPath)}>
            {returnLabel}
          </Button>
          <section className={styles.heading}>
            <Typography.Title level={2}>{installment(plan.installment, plan.id)}</Typography.Title>
            <Typography.Text type="secondary">
              仅显示服务端返回的身份、引用、进度、状态和日期；计划、已收和剩余金额、支付方式、备注和负责人不进入本页。当前身份具备字段读取权限时，自定义字段仅按服务端已裁剪的返回值展示。
            </Typography.Text>
          </section>
          {deleteMutation.isError || dueDateUpdateMutation.isError ? (
            <Alert
              title={
                deleteMutation.error instanceof ApiError
                  ? deleteMutation.error.message
                  : deleteMutation.isError
                    ? "回款计划暂时无法删除"
                    : dueDateUpdateMutation.error instanceof ApiError
                      ? dueDateUpdateMutation.error.message
                      : "回款计划到期日暂时无法更新"
              }
              showIcon
              type="error"
            />
          ) : null}
          <Card title="基本信息">
            <Descriptions column={{ sm: 1, md: 2 }}>
              <Descriptions.Item label="期数">
                {installment(plan.installment, plan.id)}
              </Descriptions.Item>
              <Descriptions.Item label="客户">客户 {plan.customerId}</Descriptions.Item>
              <Descriptions.Item label="合同">{reference(plan.contractId)}</Descriptions.Item>
              <Descriptions.Item label="到期日期">{plan.dueDate ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="进度">
                {plan.progress === null ? "—" : <Tag>{plan.progress}</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {plan.status === null ? "—" : <Tag>{plan.status}</Tag>}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          {canReadFieldMetadata && fieldDefinitionsQuery.isLoading ? (
            <Card title="自定义字段">
              <Spin aria-label="正在加载回款计划自定义字段目录" />
            </Card>
          ) : null}
          {canReadFieldMetadata && fieldDefinitionsQuery.isError ? (
            <Card title="自定义字段">
              <Alert title="回款计划自定义字段目录暂时无法加载" showIcon type="error" />
            </Card>
          ) : null}
          {canReadFieldMetadata && planDynamicFields.length > 0 ? (
            <Card title="自定义字段">
              <Typography.Paragraph type="secondary">
                值仅按服务端当前返回展示；不会作为编辑或字段权限判断的依据。
              </Typography.Paragraph>
              <ServerProvidedDynamicFieldDescriptions
                columns={{ sm: 1, xs: 1 }}
                definitions={fieldDefinitionsQuery.data ?? []}
                values={plan.customFields}
              />
            </Card>
          ) : null}
          <ControlledFileFieldDownloadCard
            canRead={canReadFileFields}
            fileFields={plan.fileFields}
            targetId={plan.id}
            targetType="receivable-plan"
            title="字段附件"
          />
          <ApprovalStartAction
            objectType="RECEIVABLE_PLAN"
            subjectId={plan.id}
            onStarted={() => {
              void queryClient.invalidateQueries({
                queryKey: receivablePlanKeys.detail(identityKey, plan.id),
              });
              void queryClient.invalidateQueries({
                queryKey: receivablePlanKeys.lists(identityKey),
              });
            }}
          />
          <RouteAuthority authority={authority.receivablePlansWrite}>
            <RouteAuthority authority={authority.contractsRead}>
              {canEditDueDate ? (
                <Button
                  onClick={() => {
                    dueDateUpdateMutation.reset();
                    setEditedDueDate(plan.dueDate ?? "");
                    setDueDateEditorOpen(true);
                  }}
                >
                  编辑到期日期
                </Button>
              ) : null}
              {canReadFieldMetadata &&
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
            </RouteAuthority>
          </RouteAuthority>
          <RouteAuthority authority={authority.receivablePlansDelete}>
            <RouteAuthority authority={authority.contractsRead}>
              <Popconfirm
                cancelText="取消"
                description="已有回款历史的计划不能删除；删除成功时服务端会撤回附件和文件字段绑定。"
                okButtonProps={{ danger: true }}
                okText="确认删除"
                title="确认删除这条回款计划？"
                onConfirm={() => deleteMutation.mutate(plan.version)}
              >
                <Button
                  danger
                  disabled={deleteMutation.isPending}
                  loading={deleteMutation.isPending}
                >
                  删除回款计划
                </Button>
              </Popconfirm>
            </RouteAuthority>
          </RouteAuthority>
          <Modal
            destroyOnHidden
            footer={
              <>
                <Button disabled={dueDateUpdateMutation.isPending} onClick={closeDueDateEditor}>
                  取消
                </Button>
                <Button
                  disabled={!canSaveDueDate}
                  loading={dueDateUpdateMutation.isPending}
                  type="primary"
                  onClick={() => {
                    if (!canSaveDueDate) return;
                    dueDateUpdateMutation.mutate({
                      dueDate: normalizedEditedDueDate,
                      originalDueDate: plan.dueDate ?? "",
                      version: plan.version,
                    });
                  }}
                >
                  保存修改
                </Button>
              </>
            }
            open={dueDateEditorOpen}
            title="编辑回款计划到期日期"
            onCancel={closeDueDateEditor}
          >
            <Typography.Paragraph type="secondary">
              仅提交本次明确修改的到期日期和当前
              version；计划金额、支付方式、提醒、备注、负责人、动态字段和附件不会读取或写入。已有回款历史是否允许修改由服务端决定。
            </Typography.Paragraph>
            <Typography.Text>到期日期</Typography.Text>
            <Input
              aria-label="到期日期"
              disabled={dueDateUpdateMutation.isPending}
              style={{ marginTop: 8 }}
              type="date"
              value={editedDueDate}
              onChange={(event) => setEditedDueDate(event.target.value)}
            />
            {dueDateUpdateMutation.isError ? (
              <Alert
                title={
                  dueDateUpdateMutation.error instanceof ApiError
                    ? dueDateUpdateMutation.error.message
                    : "回款计划到期日暂时无法更新"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
          </Modal>
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
                  disabled={fieldDefinitionsQuery.isError || changedCustomFieldCodes.size === 0}
                  loading={customFieldUpdateMutation.isPending}
                  type="primary"
                  onClick={() => {
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
                      changedCodes: changedCustomFieldCodes,
                      values: customFieldValues,
                      version: plan.version,
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
              为避免把详情中的脱敏或只读值写回，字段均从空白开始。只有本次明确填写或清除的字段会提交；未操作字段由服务端保持当前值。
            </Typography.Paragraph>
            {fieldDefinitionsQuery.isError ? (
              <Alert title="回款计划自定义字段目录暂时无法加载" showIcon type="warning" />
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
                    : "回款计划自定义字段暂时无法更新"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
          </Modal>
          <ActivityTimelineCard subjectId={plan.id} subjectType="RECEIVABLE_PLAN" />
        </main>
      );
  }
  return (
    <RouteAuthority authority={authority.receivablePlansRead}>
      <RouteAuthority authority={authority.customersRead}>{content}</RouteAuthority>
    </RouteAuthority>
  );
}
