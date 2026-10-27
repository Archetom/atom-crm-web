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
import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
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
import { customerContextReceivableReturnPath } from "~/components/entity-selector/customer-context-create-route";
import { ApprovalStartAction, ApprovalStatusTag } from "~/features/approvals";
import { ActivityTimelineCard } from "~/features/activities";

import {
  toReceivableCustomFieldUpdateRequest,
  toReceivableReceivedDateUpdateRequest,
} from "../model/receivable-form";
import { receivableKeys } from "../model/query-keys";

import styles from "./customer-receivable-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

function displayValue(value: string | null): string {
  return value ?? "—";
}

function reference(label: string, value: number | null): string {
  return value === null ? "—" : `${label} ${value}`;
}

function amount(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
}

export function CustomerReceivableDetailPage() {
  const { customerId: customerIdParam, receivableId: receivableIdParam } = useParams();
  const customerId = parseRouteId(customerIdParam);
  const receivableId = parseRouteId(receivableIdParam);

  return <CustomerReceivableDetailSurface customerId={customerId} receivableId={receivableId} />;
}

export function CustomerReceivableDetailSurface({
  customerId,
  receivableId,
  onClose,
}: Readonly<{
  customerId: number | null;
  receivableId: number | null;
  onClose?: () => void;
}>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [receivedDateEditorOpen, setReceivedDateEditorOpen] = useState(false);
  const [editedReceivedDate, setEditedReceivedDate] = useState("");
  const [customFieldEditorOpen, setCustomFieldEditorOpen] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [changedCustomFieldCodes, setChangedCustomFieldCodes] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [customFieldErrors, setCustomFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [customFieldMemberKeyword, setCustomFieldMemberKeyword] = useState("");
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerMemberKeyword, setOwnerMemberKeyword] = useState("");
  const identityKey = authState?.identityKey ?? "pending";
  const canReadReceivables = hasAuthority(authorization, authority.receivablesRead);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const canReadFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadFileFields =
    canReadReceivables && canReadCustomers && hasAuthority(authorization, authority.filesRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const globalReturnPath = customerContextReceivableReturnPath(searchParams.toString());
  const returnPath = globalReturnPath ?? `/crm/customers/${customerId ?? ""}/receivables`;
  const closeDetail = () => {
    if (onClose !== undefined) {
      onClose();
      return;
    }
    navigate(returnPath, { replace: true });
  };
  const receivableQuery = useQuery({
    queryKey: receivableKeys.detail(identityKey, receivableId ?? 0),
    queryFn: () =>
      apiClient === null || receivableId === null
        ? Promise.reject(new Error("回款详情暂时不可用。"))
        : apiClient.getReceivable(receivableId),
    enabled: apiClient !== null && receivableId !== null && canReadReceivables && canReadCustomers,
  });
  const fieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "RECEIVABLE", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回款字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("RECEIVABLE"),
    enabled:
      apiClient !== null &&
      receivableId !== null &&
      canReadReceivables &&
      canReadCustomers &&
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
      "receivable-detail-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回款自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled:
      apiClient !== null && customFieldEditorOpen && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["receivable-detail-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回款自定义部门字段的部门目录暂时不可用。"))
        : apiClient.getVisibleDepartments(),
    enabled:
      apiClient !== null &&
      customFieldEditorOpen &&
      canReadOrganization &&
      hasDepartmentCustomField,
  });
  const deleteMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || receivableId === null
        ? Promise.reject(new Error("Receivable deletion is unavailable."))
        : apiClient.deleteReceivable(receivableId, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: receivableKeys.lists(identityKey) });
      closeDetail();
    },
  });
  const receivedDateUpdateMutation = useMutation({
    mutationFn: ({
      originalReceivedDate,
      receivedDate,
      version,
    }: {
      originalReceivedDate: string;
      receivedDate: string;
      version: number;
    }) =>
      apiClient === null || receivableId === null
        ? Promise.reject(new Error("Receivable update is unavailable."))
        : apiClient
            .updateReceivable(
              receivableId,
              toReceivableReceivedDateUpdateRequest({
                originalReceivedDate,
                receivedDate,
                version,
              }),
            )
            .then((updatedReceivable) => {
              if (
                updatedReceivable.id !== receivableId ||
                (customerId !== null && updatedReceivable.customerId !== customerId)
              ) {
                throw new Error("Receivable update response does not match the current customer.");
              }
              return updatedReceivable;
            }),
    onSuccess: (updatedReceivable) => {
      queryClient.setQueryData(
        receivableKeys.detail(identityKey, updatedReceivable.id),
        updatedReceivable,
      );
      void queryClient.invalidateQueries({ queryKey: receivableKeys.lists(identityKey) });
      setReceivedDateEditorOpen(false);
      setEditedReceivedDate("");
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
      apiClient === null || receivableId === null
        ? Promise.reject(new Error("Receivable custom-field update is unavailable."))
        : apiClient
            .updateReceivable(
              receivableId,
              toReceivableCustomFieldUpdateRequest(
                customFieldDefinitions,
                values,
                changedCodes,
                version,
              ),
            )
            .then((updatedReceivable) => {
              if (
                updatedReceivable.id !== receivableId ||
                (customerId !== null && updatedReceivable.customerId !== customerId)
              ) {
                throw new Error("Receivable update response does not match the current customer.");
              }
              return updatedReceivable;
            }),
    onSuccess: (updatedReceivable) => {
      queryClient.setQueryData(
        receivableKeys.detail(identityKey, updatedReceivable.id),
        updatedReceivable,
      );
      void queryClient.invalidateQueries({ queryKey: receivableKeys.lists(identityKey) });
      setChangedCustomFieldCodes(new Set());
      setCustomFieldErrors({});
      setCustomFieldValues({});
      setCustomFieldMemberKeyword("");
      setCustomFieldEditorOpen(false);
    },
  });
  const ownerMemberQuery = useQuery({
    queryKey: ["member-selector", "receivable-owner", identityKey, ownerMemberKeyword] as const,
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
  const ownerMutation = useMutation({
    mutationFn: ({ actorId, version }: { actorId: number; version: number }) =>
      apiClient === null || receivableId === null
        ? Promise.reject(new Error("Receivable owner update is unavailable."))
        : apiClient
            .updateReceivableOwner(receivableId, { ownerActorId: actorId, version })
            .then((updatedReceivable) => {
              if (
                updatedReceivable.id !== receivableId ||
                (customerId !== null && updatedReceivable.customerId !== customerId)
              ) {
                throw new Error("Receivable owner response does not match the current customer.");
              }
              return updatedReceivable;
            }),
    onSuccess: (updatedReceivable) => {
      queryClient.setQueryData(
        receivableKeys.detail(identityKey, updatedReceivable.id),
        updatedReceivable,
      );
      void queryClient.invalidateQueries({ queryKey: receivableKeys.lists(identityKey) });
      setOwnerPickerOpen(false);
      setOwnerMemberKeyword("");
    },
  });

  function closeOwnerPicker() {
    if (ownerMutation.isPending) return;
    ownerMutation.reset();
    setOwnerPickerOpen(false);
    setOwnerMemberKeyword("");
  }

  function closeReceivedDateEditor() {
    if (receivedDateUpdateMutation.isPending) return;
    receivedDateUpdateMutation.reset();
    setReceivedDateEditorOpen(false);
    setEditedReceivedDate("");
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

  if (receivableId === null) return <StatusPage kind="not-found" />;

  let content: ReactNode;
  if (receivableQuery.isLoading) {
    content = (
      <div
        aria-label="正在加载回款详情"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  } else if (receivableQuery.isError) {
    content = (
      <StatusPage
        kind={statusKindFromError(receivableQuery.error)}
        onRetry={() => void receivableQuery.refetch()}
      />
    );
  } else {
    const receivable = receivableQuery.data;
    const receivableDynamicFields = serverProvidedDynamicFields(
      fieldDefinitionsQuery.data ?? [],
      receivable?.customFields,
    );
    const normalizedEditedReceivedDate = editedReceivedDate.trim();
    const canEditReceivedDate = receivable !== undefined && receivable.receivedDate !== null;
    const canSaveReceivedDate =
      receivable !== undefined &&
      canEditReceivedDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(normalizedEditedReceivedDate) &&
      normalizedEditedReceivedDate !== receivable.receivedDate;
    content =
      receivable === undefined || (customerId !== null && receivable.customerId !== customerId) ? (
        <StatusPage kind="not-found" />
      ) : (
        <main className={styles.page}>
          <Button icon={<ArrowLeftOutlined />} onClick={closeDetail}>
            {onClose === undefined ? "返回客户回款" : "返回回款列表"}
          </Button>
          <section className={styles.heading}>
            <Typography.Title level={2}>
              {receivable.receiptNumber ?? `回款 ${receivable.id}`}
            </Typography.Title>
            <Typography.Text type="secondary">
              仅显示服务端按当前成员字段权限返回的回款信息；隐藏或脱敏字段不会由浏览器补全。
            </Typography.Text>
          </section>
          {deleteMutation.isError || receivedDateUpdateMutation.isError ? (
            <Alert
              title={
                deleteMutation.error instanceof ApiError
                  ? deleteMutation.error.message
                  : deleteMutation.isError
                    ? "回款暂时无法删除"
                    : receivedDateUpdateMutation.error instanceof ApiError
                      ? receivedDateUpdateMutation.error.message
                      : "回款日期暂时无法更新"
              }
              showIcon
              type="error"
            />
          ) : null}
          <Card title="基本信息">
            <Descriptions column={{ sm: 1, md: 2 }}>
              <Descriptions.Item label="回款编号">
                {displayValue(receivable.receiptNumber)}
              </Descriptions.Item>
              <Descriptions.Item label="客户">客户 {receivable.customerId}</Descriptions.Item>
              <Descriptions.Item label="合同">
                {reference("合同", receivable.contractId)}
              </Descriptions.Item>
              <Descriptions.Item label="回款计划">
                {reference("计划", receivable.receivablePlanId)}
              </Descriptions.Item>
              <Descriptions.Item label="回款日期">
                {displayValue(receivable.receivedDate)}
              </Descriptions.Item>
              <Descriptions.Item label="回款金额">{amount(receivable.amount)}</Descriptions.Item>
              <Descriptions.Item label="回款方式">
                {displayValue(receivable.paymentMethod)}
              </Descriptions.Item>
              <Descriptions.Item label="备注">{displayValue(receivable.remark)}</Descriptions.Item>
              <Descriptions.Item label="负责人">
                {reference("成员", receivable.ownerActorId)}
              </Descriptions.Item>
              <Descriptions.Item label="记录状态">
                {receivable.status === null ? "—" : <Tag>{receivable.status}</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="审批状态">
                <ApprovalStatusTag status={receivable.approvalStatus} />
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {displayValue(receivable.updatedTime)}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {displayValue(receivable.createdTime)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          {canReadFieldMetadata && fieldDefinitionsQuery.isLoading ? (
            <Card title="自定义字段">
              <Spin aria-label="正在加载回款自定义字段目录" />
            </Card>
          ) : null}
          {canReadFieldMetadata && fieldDefinitionsQuery.isError ? (
            <Card title="自定义字段">
              <Alert title="回款自定义字段目录暂时无法加载" showIcon type="error" />
            </Card>
          ) : null}
          {canReadFieldMetadata && receivableDynamicFields.length > 0 ? (
            <Card title="自定义字段">
              <Typography.Paragraph type="secondary">
                值仅按服务端当前返回展示；不会作为编辑或字段权限判断的依据。
              </Typography.Paragraph>
              <ServerProvidedDynamicFieldDescriptions
                columns={{ sm: 1, xs: 1 }}
                definitions={fieldDefinitionsQuery.data ?? []}
                values={receivable.customFields}
              />
            </Card>
          ) : null}
          <ControlledFileFieldDownloadCard
            canRead={canReadFileFields}
            fileFields={receivable.fileFields}
            targetId={receivable.id}
            targetType="receivable"
            title="字段附件"
          />
          <ApprovalStartAction
            objectType="RECEIVABLE"
            subjectId={receivable.id}
            onStarted={() => {
              void queryClient.invalidateQueries({
                queryKey: receivableKeys.detail(identityKey, receivable.id),
              });
              void queryClient.invalidateQueries({ queryKey: receivableKeys.lists(identityKey) });
            }}
          />
          <RouteAuthority authority={authority.receivablesWrite}>
            <RouteAuthority authority={authority.contractsRead}>
              {canEditReceivedDate ? (
                <Button
                  onClick={() => {
                    receivedDateUpdateMutation.reset();
                    setEditedReceivedDate(receivable.receivedDate ?? "");
                    setReceivedDateEditorOpen(true);
                  }}
                >
                  编辑回款日期
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
          <ActionAuthority authority={authority.receivablesAssign}>
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
          <RouteAuthority authority={authority.receivablesDelete}>
            <Popconfirm
              cancelText="取消"
              description="删除后回款会进入服务端软删除状态，并撤回其附件和文件字段绑定。"
              okButtonProps={{ danger: true }}
              okText="确认删除"
              title="确认删除这笔回款？"
              onConfirm={() => deleteMutation.mutate(receivable.version)}
            >
              <Button danger disabled={deleteMutation.isPending} loading={deleteMutation.isPending}>
                删除回款
              </Button>
            </Popconfirm>
          </RouteAuthority>
          <Modal
            destroyOnHidden
            footer={
              <>
                <Button
                  disabled={receivedDateUpdateMutation.isPending}
                  onClick={closeReceivedDateEditor}
                >
                  取消
                </Button>
                <Button
                  disabled={!canSaveReceivedDate}
                  loading={receivedDateUpdateMutation.isPending}
                  type="primary"
                  onClick={() => {
                    if (!canSaveReceivedDate) return;
                    receivedDateUpdateMutation.mutate({
                      originalReceivedDate: receivable.receivedDate ?? "",
                      receivedDate: normalizedEditedReceivedDate,
                      version: receivable.version,
                    });
                  }}
                >
                  保存修改
                </Button>
              </>
            }
            open={receivedDateEditorOpen}
            title="编辑回款日期"
            onCancel={closeReceivedDateEditor}
          >
            <Typography.Paragraph type="secondary">
              仅提交本次明确修改的回款日期和当前
              version；关联计划、金额、支付方式、备注、负责人、动态字段和附件均不会由此操作修改。
            </Typography.Paragraph>
            <Typography.Text>回款日期</Typography.Text>
            <Input
              aria-label="回款日期"
              disabled={receivedDateUpdateMutation.isPending}
              style={{ marginTop: 8 }}
              type="date"
              value={editedReceivedDate}
              onChange={(event) => setEditedReceivedDate(event.target.value)}
            />
            {receivedDateUpdateMutation.isError ? (
              <Alert
                title={
                  receivedDateUpdateMutation.error instanceof ApiError
                    ? receivedDateUpdateMutation.error.message
                    : "回款日期暂时无法更新"
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
                      version: receivable.version,
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
              <Alert title="回款自定义字段目录暂时无法加载" showIcon type="warning" />
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
                    : "回款自定义字段暂时无法更新"
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
              仅显示服务端允许当前成员查看的在职成员；最终可分配范围、字段权限和并发仍由服务端校验。
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
                        disabled={ownerMutation.isPending}
                        key={member.actorId}
                        loading={ownerMutation.isPending}
                        type="link"
                        onClick={() =>
                          ownerMutation.mutate({
                            actorId: member.actorId,
                            version: receivable.version,
                          })
                        }
                      >
                        选择
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
                    : "回款负责人暂时无法更新"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
          </Modal>
          <ActivityTimelineCard subjectId={receivable.id} subjectType="RECEIVABLE" />
        </main>
      );
  }
  return (
    <RouteAuthority authority={authority.receivablesRead}>
      <RouteAuthority authority={authority.customersRead}>{content}</RouteAuthority>
    </RouteAuthority>
  );
}
