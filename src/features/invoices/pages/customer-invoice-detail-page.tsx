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
import { useNavigate, useParams } from "react-router";

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
import { ActivityTimelineCard } from "~/features/activities";
import { ApprovalStartAction } from "~/features/approvals";

import {
  toInvoiceBasicUpdateRequest,
  toInvoiceCustomFieldUpdateRequest,
} from "../model/invoice-form";
import { invoiceKeys } from "../model/query-keys";

import styles from "./customer-invoice-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

function displayValue(value: string | null): string {
  return value ?? "—";
}

interface InvoiceIssueFormValues {
  invoiceNumber?: string;
  issuedDate?: string;
  logisticsNumber?: string;
}

export function CustomerInvoiceDetailPage() {
  const { customerId: customerIdParam, invoiceId: invoiceIdParam } = useParams();
  const customerId = parseRouteId(customerIdParam);
  const invoiceId = parseRouteId(invoiceIdParam);

  return <CustomerInvoiceDetailSurface customerId={customerId} invoiceId={invoiceId} />;
}

export function CustomerInvoiceDetailSurface({
  customerId,
  invoiceId,
  onClose,
}: Readonly<{
  customerId: number | null;
  invoiceId: number | null;
  onClose?: () => void;
}>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [issueForm] = Form.useForm<InvoiceIssueFormValues>();
  const [basicEditorOpen, setBasicEditorOpen] = useState(false);
  const [editedInvoiceType, setEditedInvoiceType] = useState("");
  const [editedRequestedDate, setEditedRequestedDate] = useState("");
  const [customFieldEditorOpen, setCustomFieldEditorOpen] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [changedCustomFieldCodes, setChangedCustomFieldCodes] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [customFieldErrors, setCustomFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [customFieldMemberKeyword, setCustomFieldMemberKeyword] = useState("");
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerMemberKeyword, setOwnerMemberKeyword] = useState("");
  const identityKey = authState?.identityKey ?? "pending";
  const canReadInvoices = hasAuthority(authorization, authority.invoicesRead);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const canReadFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadFileFields =
    canReadInvoices && canReadCustomers && hasAuthority(authorization, authority.filesRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const closeDetail = () => {
    if (onClose !== undefined) {
      onClose();
      return;
    }
    navigate(`/crm/customers/${customerId ?? ""}/invoices`, { replace: true });
  };
  const invoiceQuery = useQuery({
    queryKey: invoiceKeys.detail(identityKey, invoiceId ?? 0),
    queryFn: () =>
      apiClient === null || invoiceId === null
        ? Promise.reject(new Error("发票详情暂时不可用。"))
        : apiClient.getInvoice(invoiceId),
    enabled: apiClient !== null && invoiceId !== null && canReadInvoices && canReadCustomers,
  });
  const fieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "INVOICE", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("发票字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("INVOICE"),
    enabled:
      apiClient !== null &&
      invoiceId !== null &&
      canReadInvoices &&
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
      "invoice-detail-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("发票自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled:
      apiClient !== null && customFieldEditorOpen && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["invoice-detail-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("发票自定义部门字段的部门目录暂时不可用。"))
        : apiClient.getVisibleDepartments(),
    enabled:
      apiClient !== null &&
      customFieldEditorOpen &&
      canReadOrganization &&
      hasDepartmentCustomField,
  });
  const deleteMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || invoiceId === null
        ? Promise.reject(new Error("Invoice deletion is unavailable."))
        : apiClient.deleteInvoice(invoiceId, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists(identityKey) });
      closeDetail();
    },
  });
  const resetMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || invoiceId === null
        ? Promise.reject(new Error("Invoice reset is unavailable."))
        : apiClient.resetInvoice(invoiceId, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists(identityKey) });
      void queryClient.invalidateQueries({
        queryKey: invoiceKeys.detail(identityKey, invoiceId ?? 0),
      });
    },
  });
  const basicUpdateMutation = useMutation({
    mutationFn: ({
      invoiceType,
      originalInvoiceType,
      originalRequestedDate,
      requestedDate,
      version,
    }: {
      invoiceType: string;
      originalInvoiceType: string;
      originalRequestedDate: string;
      requestedDate: string;
      version: number;
    }) =>
      apiClient === null || invoiceId === null
        ? Promise.reject(new Error("Invoice update is unavailable."))
        : apiClient
            .updateInvoice(
              invoiceId,
              toInvoiceBasicUpdateRequest({
                invoiceType,
                originalInvoiceType,
                originalRequestedDate,
                requestedDate,
                version,
              }),
            )
            .then((updatedInvoice) => {
              if (
                updatedInvoice.id !== invoiceId ||
                (customerId !== null && updatedInvoice.customerId !== customerId)
              ) {
                throw new Error("Invoice update response does not match the current customer.");
              }
              return updatedInvoice;
            }),
    onSuccess: (updatedInvoice) => {
      queryClient.setQueryData(invoiceKeys.detail(identityKey, updatedInvoice.id), updatedInvoice);
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists(identityKey) });
      setBasicEditorOpen(false);
      setEditedInvoiceType("");
      setEditedRequestedDate("");
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
      apiClient === null || invoiceId === null
        ? Promise.reject(new Error("Invoice custom-field update is unavailable."))
        : apiClient
            .updateInvoice(
              invoiceId,
              toInvoiceCustomFieldUpdateRequest(
                customFieldDefinitions,
                values,
                changedCodes,
                version,
              ),
            )
            .then((updatedInvoice) => {
              if (
                updatedInvoice.id !== invoiceId ||
                (customerId !== null && updatedInvoice.customerId !== customerId)
              ) {
                throw new Error("Invoice update response does not match the current customer.");
              }
              return updatedInvoice;
            }),
    onSuccess: (updatedInvoice) => {
      queryClient.setQueryData(invoiceKeys.detail(identityKey, updatedInvoice.id), updatedInvoice);
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists(identityKey) });
      setChangedCustomFieldCodes(new Set());
      setCustomFieldErrors({});
      setCustomFieldValues({});
      setCustomFieldMemberKeyword("");
      setCustomFieldEditorOpen(false);
    },
  });
  const issueMutation = useMutation({
    mutationFn: ({
      invoiceNumber,
      issuedDate,
      logisticsNumber,
      version,
    }: {
      invoiceNumber: string;
      issuedDate: string;
      logisticsNumber?: string;
      version: number;
    }) =>
      apiClient === null || invoiceId === null
        ? Promise.reject(new Error("Invoice issue is unavailable."))
        : apiClient
            .issueInvoice(invoiceId, {
              invoiceNumber,
              issuedDate,
              ...(logisticsNumber === undefined ? {} : { logisticsNumber }),
              version,
            })
            .then((updatedInvoice) => {
              if (
                updatedInvoice.id !== invoiceId ||
                (customerId !== null && updatedInvoice.customerId !== customerId)
              ) {
                throw new Error("Invoice issue response does not match the current customer.");
              }
              return updatedInvoice;
            }),
    onSuccess: (updatedInvoice) => {
      queryClient.setQueryData(invoiceKeys.detail(identityKey, updatedInvoice.id), updatedInvoice);
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists(identityKey) });
      issueForm.resetFields();
      setIssueModalOpen(false);
    },
  });
  const ownerMemberQuery = useQuery({
    queryKey: ["member-selector", "invoice-owner", identityKey, ownerMemberKeyword] as const,
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
      apiClient === null || invoiceId === null
        ? Promise.reject(new Error("Invoice owner update is unavailable."))
        : apiClient.updateInvoiceOwner(invoiceId, { ownerActorId: actorId, version }),
    onSuccess: (updatedInvoice) => {
      queryClient.setQueryData(invoiceKeys.detail(identityKey, updatedInvoice.id), updatedInvoice);
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists(identityKey) });
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

  function closeIssueModal() {
    if (issueMutation.isPending) return;
    issueMutation.reset();
    issueForm.resetFields();
    setIssueModalOpen(false);
  }

  function closeBasicEditor() {
    if (basicUpdateMutation.isPending) return;
    basicUpdateMutation.reset();
    setBasicEditorOpen(false);
    setEditedInvoiceType("");
    setEditedRequestedDate("");
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

  if (invoiceId === null) return <StatusPage kind="not-found" />;

  let content: ReactNode;
  if (invoiceQuery.isLoading) {
    content = (
      <div
        aria-label="正在加载发票详情"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  } else if (invoiceQuery.isError) {
    content = (
      <StatusPage
        kind={statusKindFromError(invoiceQuery.error)}
        onRetry={() => void invoiceQuery.refetch()}
      />
    );
  } else {
    const invoice = invoiceQuery.data;
    const invoiceDynamicFields = serverProvidedDynamicFields(
      fieldDefinitionsQuery.data ?? [],
      invoice?.customFields,
    );
    const normalizedEditedInvoiceType = editedInvoiceType.trim();
    const normalizedEditedRequestedDate = editedRequestedDate.trim();
    const canEditBasics =
      invoice !== undefined && invoice.invoiceType !== null && invoice.requestedDate !== null;
    const canSaveBasics =
      invoice !== undefined &&
      canEditBasics &&
      normalizedEditedInvoiceType.length > 0 &&
      normalizedEditedInvoiceType.length <= 50 &&
      /^\d{4}-\d{2}-\d{2}$/.test(normalizedEditedRequestedDate) &&
      (normalizedEditedInvoiceType !== invoice.invoiceType ||
        normalizedEditedRequestedDate !== invoice.requestedDate);
    content =
      invoice === undefined || (customerId !== null && invoice.customerId !== customerId) ? (
        <StatusPage kind="not-found" />
      ) : (
        <main className={styles.page}>
          <Button icon={<ArrowLeftOutlined />} onClick={closeDetail}>
            {onClose === undefined ? "返回客户发票" : "返回发票列表"}
          </Button>
          <section className={styles.heading}>
            <Typography.Title level={2}>
              {invoice.applicationNumber ?? invoice.invoiceNumber ?? `发票 ${invoice.id}`}
            </Typography.Title>
            <Typography.Text type="secondary">
              仅显示服务端返回的身份、引用、状态和日期；金额、开票抬头、税号、银行、联系人、收件信息、物流、备注和附件不进入详情投影或缓存。当前身份具备字段读取权限时，自定义字段仅按服务端已裁剪的返回值展示。
            </Typography.Text>
          </section>
          {deleteMutation.isError || resetMutation.isError || basicUpdateMutation.isError ? (
            <Alert
              title={
                deleteMutation.isError
                  ? deleteMutation.error instanceof ApiError
                    ? deleteMutation.error.message
                    : "发票暂时无法删除"
                  : resetMutation.isError
                    ? resetMutation.error instanceof ApiError
                      ? resetMutation.error.message
                      : "发票暂时无法重置"
                    : basicUpdateMutation.error instanceof ApiError
                      ? basicUpdateMutation.error.message
                      : "发票基础信息暂时无法更新"
              }
              showIcon
              type="error"
            />
          ) : null}
          <Card title="基本信息">
            <Descriptions column={{ sm: 1, md: 2 }}>
              <Descriptions.Item label="申请编号">
                {displayValue(invoice.applicationNumber)}
              </Descriptions.Item>
              <Descriptions.Item label="发票号码">
                {displayValue(invoice.invoiceNumber)}
              </Descriptions.Item>
              <Descriptions.Item label="客户">客户 {invoice.customerId}</Descriptions.Item>
              <Descriptions.Item label="合同">
                {invoice.contractId === null ? "—" : `合同 ${invoice.contractId}`}
              </Descriptions.Item>
              <Descriptions.Item label="发票类型">
                {displayValue(invoice.invoiceType)}
              </Descriptions.Item>
              <Descriptions.Item label="申请日期">
                {displayValue(invoice.requestedDate)}
              </Descriptions.Item>
              <Descriptions.Item label="开票日期">
                {displayValue(invoice.issuedDate)}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {invoice.status === null ? "—" : <Tag>{invoice.status}</Tag>}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          {canReadFieldMetadata && fieldDefinitionsQuery.isLoading ? (
            <Card title="自定义字段">
              <Spin aria-label="正在加载发票自定义字段目录" />
            </Card>
          ) : null}
          {canReadFieldMetadata && fieldDefinitionsQuery.isError ? (
            <Card title="自定义字段">
              <Alert title="发票自定义字段目录暂时无法加载" showIcon type="error" />
            </Card>
          ) : null}
          {canReadFieldMetadata && invoiceDynamicFields.length > 0 ? (
            <Card title="自定义字段">
              <Typography.Paragraph type="secondary">
                值仅按服务端当前返回展示；不会作为编辑或字段权限判断的依据。
              </Typography.Paragraph>
              <ServerProvidedDynamicFieldDescriptions
                columns={{ sm: 1, xs: 1 }}
                definitions={fieldDefinitionsQuery.data ?? []}
                values={invoice.customFields}
              />
            </Card>
          ) : null}
          <ControlledFileFieldDownloadCard
            canRead={canReadFileFields}
            fileFields={invoice.fileFields}
            targetId={invoice.id}
            targetType="invoice"
            title="字段附件"
          />
          <ApprovalStartAction
            objectType="INVOICE"
            subjectId={invoice.id}
            onStarted={() => {
              void queryClient.invalidateQueries({
                queryKey: invoiceKeys.detail(identityKey, invoice.id),
              });
              void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists(identityKey) });
            }}
          />
          <RouteAuthority authority={authority.invoicesWrite}>
            <RouteAuthority authority={authority.contractsRead}>
              {canEditBasics ? (
                <Button
                  onClick={() => {
                    basicUpdateMutation.reset();
                    setEditedInvoiceType(invoice.invoiceType ?? "");
                    setEditedRequestedDate(invoice.requestedDate ?? "");
                    setBasicEditorOpen(true);
                  }}
                >
                  编辑基本信息
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
          <ActionAuthority authority={authority.invoicesAssign}>
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
          {invoice.status === "PENDING" ? (
            <RouteAuthority authority={authority.invoicesIssue}>
              <Button
                onClick={() => {
                  issueMutation.reset();
                  issueForm.resetFields();
                  setIssueModalOpen(true);
                }}
              >
                登记开票结果
              </Button>
            </RouteAuthority>
          ) : null}
          {invoice.status === "ISSUED" ? (
            <RouteAuthority authority={authority.invoicesIssue}>
              <Popconfirm
                cancelText="取消"
                description="重置会由服务端复核当前开票状态、字段写入权限和并发版本。"
                okText="确认重置"
                title="确认重置这张发票的开票结果？"
                onConfirm={() => resetMutation.mutate(invoice.version)}
              >
                <Button disabled={resetMutation.isPending} loading={resetMutation.isPending}>
                  重置开票结果
                </Button>
              </Popconfirm>
            </RouteAuthority>
          ) : null}
          <RouteAuthority authority={authority.invoicesDelete}>
            <Popconfirm
              cancelText="取消"
              description="删除后发票会进入服务端软删除状态，并撤回其附件和文件字段绑定。"
              okButtonProps={{ danger: true }}
              okText="确认删除"
              title="确认删除这张发票？"
              onConfirm={() => deleteMutation.mutate(invoice.version)}
            >
              <Button danger disabled={deleteMutation.isPending} loading={deleteMutation.isPending}>
                删除发票
              </Button>
            </Popconfirm>
          </RouteAuthority>
          <Modal
            destroyOnHidden
            footer={
              <>
                <Button disabled={basicUpdateMutation.isPending} onClick={closeBasicEditor}>
                  取消
                </Button>
                <Button
                  disabled={!canSaveBasics}
                  loading={basicUpdateMutation.isPending}
                  type="primary"
                  onClick={() => {
                    if (!canSaveBasics) return;
                    basicUpdateMutation.mutate({
                      invoiceType: normalizedEditedInvoiceType,
                      originalInvoiceType: invoice.invoiceType ?? "",
                      originalRequestedDate: invoice.requestedDate ?? "",
                      requestedDate: normalizedEditedRequestedDate,
                      version: invoice.version,
                    });
                  }}
                >
                  保存修改
                </Button>
              </>
            }
            open={basicEditorOpen}
            title="编辑发票基本信息"
            onCancel={closeBasicEditor}
          >
            <Typography.Paragraph type="secondary">
              仅提交本次明确修改的申请日期、发票类型和当前
              version；金额、开票抬头、税号、银行、联系人、收件信息、物流、备注、动态字段和附件不会读取或写入。
            </Typography.Paragraph>
            <Typography.Text>发票类型</Typography.Text>
            <Input
              aria-label="发票类型"
              disabled={basicUpdateMutation.isPending}
              maxLength={50}
              style={{ marginTop: 8 }}
              value={editedInvoiceType}
              onChange={(event) => setEditedInvoiceType(event.target.value)}
            />
            <Typography.Text style={{ display: "block", marginTop: 16 }}>申请日期</Typography.Text>
            <Input
              aria-label="申请日期"
              disabled={basicUpdateMutation.isPending}
              style={{ marginTop: 8 }}
              type="date"
              value={editedRequestedDate}
              onChange={(event) => setEditedRequestedDate(event.target.value)}
            />
            {basicUpdateMutation.isError ? (
              <Alert
                title={
                  basicUpdateMutation.error instanceof ApiError
                    ? basicUpdateMutation.error.message
                    : "发票基础信息暂时无法更新"
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
                      version: invoice.version,
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
              <Alert title="发票自定义字段目录暂时无法加载" showIcon type="warning" />
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
                    : "发票自定义字段暂时无法更新"
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
            open={issueModalOpen}
            title="登记开票结果"
            onCancel={closeIssueModal}
          >
            <Typography.Paragraph type="secondary">
              仅提交本次直接填写的发票号码、开票日期和可选物流单号；不会读取或预填其他发票资料，服务端会重新校验状态、写入范围、字段权限与并发版本。
            </Typography.Paragraph>
            <Form
              form={issueForm}
              layout="vertical"
              onFinish={(values: InvoiceIssueFormValues) => {
                const invoiceNumber = values.invoiceNumber?.trim();
                const issuedDate = values.issuedDate;
                const logisticsNumber = values.logisticsNumber?.trim();
                if (
                  invoiceNumber === undefined ||
                  invoiceNumber === "" ||
                  issuedDate === undefined ||
                  !/^\d{4}-\d{2}-\d{2}$/.test(issuedDate)
                ) {
                  return;
                }
                issueMutation.mutate({
                  invoiceNumber,
                  issuedDate,
                  ...(logisticsNumber === undefined || logisticsNumber === ""
                    ? {}
                    : { logisticsNumber }),
                  version: invoice.version,
                });
              }}
            >
              <Form.Item
                label="发票号码"
                name="invoiceNumber"
                rules={[
                  { required: true, whitespace: true, message: "请输入发票号码" },
                  { max: 100, message: "发票号码不能超过 100 个字符" },
                ]}
              >
                <Input
                  aria-label="发票号码"
                  disabled={issueMutation.isPending}
                  maxLength={100}
                  placeholder="请输入本次开具的发票号码"
                />
              </Form.Item>
              <Form.Item
                label="开票日期"
                name="issuedDate"
                rules={[{ required: true, message: "请选择开票日期" }]}
              >
                <Input aria-label="开票日期" disabled={issueMutation.isPending} type="date" />
              </Form.Item>
              <Form.Item
                label="物流单号"
                name="logisticsNumber"
                rules={[{ max: 100, message: "物流单号不能超过 100 个字符" }]}
              >
                <Input
                  aria-label="物流单号"
                  disabled={issueMutation.isPending}
                  maxLength={100}
                  placeholder="可选：输入本次寄送物流单号"
                />
              </Form.Item>
              <Typography.Paragraph type="secondary">
                提交失败不会自动重试；如状态或版本已变化，请关闭后重新读取详情再操作。
              </Typography.Paragraph>
              {issueMutation.isError ? (
                <Alert
                  title={
                    issueMutation.error instanceof ApiError
                      ? issueMutation.error.message
                      : "开票结果暂时无法登记"
                  }
                  showIcon
                  type="error"
                />
              ) : null}
              <Space style={{ marginTop: 12 }}>
                <Button disabled={issueMutation.isPending} onClick={closeIssueModal}>
                  取消
                </Button>
                <Button htmlType="submit" loading={issueMutation.isPending} type="primary">
                  确认登记
                </Button>
              </Space>
            </Form>
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
                            version: invoice.version,
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
                    : "发票负责人暂时无法更新"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
          </Modal>
          <ActivityTimelineCard subjectId={invoice.id} subjectType="INVOICE" />
        </main>
      );
  }
  return (
    <RouteAuthority authority={authority.invoicesRead}>
      <RouteAuthority authority={authority.customersRead}>{content}</RouteAuthority>
    </RouteAuthority>
  );
}
