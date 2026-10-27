import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Input, List, Modal, Space, Typography } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import type { components } from "~/api/generated/schema";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  customFileFieldDefinitions,
  customFieldFormDefinitions,
  createFieldMetadataQueryKeys,
  unsupportedRequiredCustomFieldDefinitions,
} from "~/components/dynamic-field";
import type { CustomerOption } from "~/components/entity-selector/customer-option";

import { CustomerBaseForm } from "../components/customer-base-form";
import {
  CustomerCreateFileFieldControls,
  type CustomerCreateFileFields,
} from "../components/customer-create-file-field-controls";
import {
  toCustomerCreateRequest,
  toCustomerDuplicateCheckRequest,
  type CustomerBaseFormValues,
} from "../model/customer-form";
import { customerKeys } from "../model/query-keys";

import styles from "../components/customer-form-modal.module.css";

type CustomerCreateDestination = "customer" | "contact";

interface CustomerCreateFileDraftState {
  draft: components["schemas"]["FileFieldDraftResponse"];
  filesByField: CustomerCreateFileFields;
}

export function CustomerCreatePage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const canCreateContacts = hasAuthority(authorization, authority.contactsWrite);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const canReadCustomFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canWriteFiles = hasAuthority(authorization, authority.filesWrite);
  const customFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "CUSTOMER", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("客户字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("CUSTOMER"),
    enabled: apiClient !== null && canReadCustomFieldMetadata,
  });
  const customFieldDefinitions = customFieldDefinitionsQuery.data ?? [];
  const customFormFieldDefinitions = customFieldFormDefinitions(customFieldDefinitions);
  const customFileFields = customFileFieldDefinitions(customFieldDefinitions);
  const unsupportedRequiredCustomFields =
    unsupportedRequiredCustomFieldDefinitions(customFieldDefinitions);
  const hasMemberCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "USER",
  );
  const hasDepartmentCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "DEPARTMENT",
  );
  const [customFieldMemberKeyword, setCustomFieldMemberKeyword] = useState("");
  const customFieldMemberQuery = useQuery({
    queryKey: [
      "customer-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("客户自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: apiClient !== null && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["customer-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("客户自定义部门字段的部门目录暂时不可用。"))
        : apiClient.getVisibleDepartments(),
    enabled: apiClient !== null && canReadOrganization && hasDepartmentCustomField,
  });
  const unavailableRequiredCandidateFields = customFormFieldDefinitions.filter((field) => {
    if (!field.required) return false;
    if (field.fieldType === "USER") {
      return (
        !canReadOrganization ||
        customFieldMemberQuery.isLoading ||
        customFieldMemberQuery.isError ||
        customFieldMemberQuery.data === undefined ||
        customFieldMemberQuery.data.length === 0
      );
    }
    if (field.fieldType === "DEPARTMENT") {
      return (
        !canReadOrganization ||
        customFieldDepartmentQuery.isLoading ||
        customFieldDepartmentQuery.isError ||
        customFieldDepartmentQuery.data === undefined ||
        customFieldDepartmentQuery.data.length === 0
      );
    }
    return false;
  });
  const unavailableRequiredFileFields = customFileFields.filter(
    (field) => field.required && !canWriteFiles,
  );
  const [fileFieldDraft, setFileFieldDraft] = useState<CustomerCreateFileDraftState | null>(null);
  const [fileFieldErrors, setFileFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [parentCustomerPickerOpen, setParentCustomerPickerOpen] = useState(false);
  const [parentCustomerKeyword, setParentCustomerKeyword] = useState("");
  const [selectedParentCustomer, setSelectedParentCustomer] = useState<CustomerOption | null>(null);
  const requestedParentCustomerId = selectedParentCustomer?.id ?? null;
  const parentCustomerContextQuery = useQuery({
    queryKey: ["customer-create-parent", identityKey, requestedParentCustomerId] as const,
    queryFn: () =>
      apiClient === null || requestedParentCustomerId === null
        ? Promise.reject(new Error("Customer parent context is unavailable."))
        : apiClient.getCustomer(requestedParentCustomerId),
    enabled: apiClient !== null && requestedParentCustomerId !== null && canReadCustomers,
  });
  const parentCustomerId =
    parentCustomerContextQuery.data?.id === requestedParentCustomerId
      ? parentCustomerContextQuery.data.id
      : undefined;
  const parentCustomerAssociationPending =
    requestedParentCustomerId !== null && parentCustomerId === undefined;
  const parentCustomerCandidateQuery = useQuery({
    queryKey: ["customer-create-parent-selector", identityKey, parentCustomerKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer parent selection is unavailable."))
        : apiClient.getVisibleCustomers({
            keyword: parentCustomerKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: apiClient !== null && parentCustomerPickerOpen && canReadCustomers,
  });
  const createMutation = useMutation({
    mutationFn: ({
      fileFieldSubmission,
      parentCustomerId,
      values,
    }: {
      destination: CustomerCreateDestination;
      fileFieldSubmission?: {
        draftId: number;
        fields: Readonly<Record<string, readonly number[]>>;
      };
      parentCustomerId?: number;
      values: CustomerBaseFormValues;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("Customer creation is unavailable."))
        : apiClient.createCustomer(
            toCustomerCreateRequest(values, parentCustomerId, fileFieldSubmission),
          ),
    onSuccess: (customer, { destination }) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
      queryClient.setQueryData(customerKeys.detail(identityKey, customer.id), customer);
      if (destination === "contact") {
        const search = new URLSearchParams({
          customerId: String(customer.id),
          returnTo: `/crm/customers/${customer.id}`,
        });
        navigate(`/crm/contacts/new?${search.toString()}`, { replace: true });
        return;
      }
      navigate(`/crm/customers/${customer.id}`, { replace: true });
    },
  });
  const duplicateMutation = useMutation({
    mutationFn: (values: CustomerBaseFormValues) =>
      apiClient === null
        ? Promise.reject(new Error("Customer duplicate check is unavailable."))
        : apiClient.checkCustomerDuplicate(toCustomerDuplicateCheckRequest(values)),
  });
  const fileFieldUploadMutation = useMutation({
    mutationFn: async ({ fieldCode, files }: { fieldCode: string; files: readonly File[] }) => {
      if (apiClient === null) throw new Error("客户文件上传暂时不可用。");
      const draft = fileFieldDraft?.draft ?? (await apiClient.createCrmFileFieldDraft("CUSTOMER"));
      const uploaded = await apiClient.uploadCrmFileFieldFiles(draft, fieldCode, files);
      return { fieldCode, uploaded };
    },
    onSuccess: ({ fieldCode, uploaded }) => {
      setFileFieldDraft((current) => {
        const existingFiles = current?.filesByField[fieldCode] ?? [];
        const knownIds = new Set(existingFiles.map((file) => file.fileId));
        return {
          draft: uploaded.draft,
          filesByField: {
            ...(current?.filesByField ?? {}),
            [fieldCode]: [
              ...existingFiles,
              ...uploaded.files.filter((file) => !knownIds.has(file.fileId)),
            ],
          },
        };
      });
      setFileFieldErrors((current) => {
        if (current[fieldCode] === undefined) return current;
        return Object.fromEntries(
          Object.entries(current).filter(([currentCode]) => currentCode !== fieldCode),
        );
      });
    },
  });

  function closeParentCustomerPicker() {
    setParentCustomerPickerOpen(false);
    setParentCustomerKeyword("");
  }

  function chooseParentCustomer(customer: CustomerOption) {
    setSelectedParentCustomer(customer);
    closeParentCustomerPicker();
  }

  function submit(destination: CustomerCreateDestination, values: CustomerBaseFormValues) {
    if (requestedParentCustomerId !== null && parentCustomerId !== requestedParentCustomerId) {
      return;
    }
    const missingFileErrors = Object.fromEntries(
      customFileFields.flatMap((field) => {
        if (!field.required || (fileFieldDraft?.filesByField[field.code]?.length ?? 0) > 0)
          return [];
        return [[field.code, `${field.displayName}为必填项`]];
      }),
    );
    setFileFieldErrors(missingFileErrors);
    if (Object.keys(missingFileErrors).length > 0) return;
    createMutation.mutate({
      destination,
      fileFieldSubmission:
        fileFieldDraft === null
          ? undefined
          : {
              draftId: fileFieldDraft.draft.id,
              fields: Object.fromEntries(
                Object.entries(fileFieldDraft.filesByField).map(([code, files]) => [
                  code,
                  files.map((file) => file.fileId),
                ]),
              ),
            },
      parentCustomerId,
      values,
    });
  }

  return (
    <RouteAuthority authority={authority.customersWrite}>
      <Modal
        destroyOnHidden
        footer={null}
        open
        rootClassName={styles.modal}
        title="新建客户"
        width="min(960px, calc(100vw - 96px))"
        onCancel={() => navigate("/crm/customers")}
      >
        <main>
          <Typography.Title className={styles.formHeading} level={4}>
            基本信息
          </Typography.Title>
          {createMutation.isError ? (
            <Alert
              title={
                createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : "客户暂时无法创建"
              }
              showIcon
              type="error"
            />
          ) : null}
          {parentCustomerContextQuery.isError ? (
            <Alert
              description="所选上级客户可能已不可见或已变更。为避免写入未经确认的层级关系，当前不会创建客户。"
              title="上级客户暂时无法确认"
              showIcon
              type="error"
            />
          ) : null}
          {parentCustomerId !== undefined ? (
            <Alert
              description="此层级关系只来自当前身份下服务端确认的客户详情；创建请求仅提交其 ID，服务端会再次复核可见性与层级规则。"
              title={`将设置上级客户：${parentCustomerContextQuery.data?.name ?? `客户 ${parentCustomerId}`}`}
              showIcon
              type="info"
            />
          ) : null}
          {duplicateMutation.isError ? (
            <Alert
              title={
                duplicateMutation.error instanceof ApiError
                  ? duplicateMutation.error.message
                  : "客户暂时无法查重"
              }
              showIcon
              type="error"
            />
          ) : null}
          {duplicateMutation.data !== undefined ? (
            <Alert
              description="这是当前输入的最近一次检查结果；最终创建仍以服务端校验为准。"
              title={
                duplicateMutation.data
                  ? "发现当前可见范围内存在重复客户，请核对后再创建。"
                  : "当前可见范围内未发现重复客户。"
              }
              showIcon
              type={duplicateMutation.data ? "warning" : "success"}
            />
          ) : null}
          {customFieldDefinitionsQuery.isError ? (
            <Alert
              description="基础字段仍可填写；如租户配置了必填动态字段，请在字段目录恢复后再提交。"
              title="客户自定义字段暂时无法加载"
              showIcon
              type="warning"
            />
          ) : null}
          {unsupportedRequiredCustomFields.length > 0 ? (
            <Alert
              description={`字段目录将这些字段标为必填，但当前没有可安全选择候选或完成上传的专用流程：${unsupportedRequiredCustomFields.map((field) => field.displayName).join("、")}。为避免静默遗漏必填数据，暂不允许创建。`}
              title="存在尚未支持的必填自定义字段"
              showIcon
              type="error"
            />
          ) : null}
          {unavailableRequiredCandidateFields.length > 0 ? (
            <Alert
              description={`字段目录将这些字段标为必填，但当前身份下无法加载可选择的${canReadOrganization ? "成员或部门" : "组织"}目录：${unavailableRequiredCandidateFields.map((field) => field.displayName).join("、")}。为避免提交猜测的 ID，暂不允许创建。`}
              title="必填自定义字段的候选目录暂时不可用"
              showIcon
              type="error"
            />
          ) : null}
          {unavailableRequiredFileFields.length > 0 ? (
            <Alert
              description={`字段目录将这些文件字段标为必填，但当前身份没有文件写入权限：${unavailableRequiredFileFields.map((field) => field.displayName).join("、")}。为避免遗漏必填附件，暂不允许创建。`}
              title="必填自定义文件字段不可用"
              showIcon
              type="error"
            />
          ) : null}
          {fileFieldUploadMutation.isError ? (
            <Alert
              title={
                fileFieldUploadMutation.error instanceof ApiError
                  ? fileFieldUploadMutation.error.message
                  : "客户文件暂时无法上传"
              }
              showIcon
              type="error"
            />
          ) : null}
          {canReadCustomers ? (
            <Card size="small" title="上级客户（可选）">
              <Space wrap>
                <Typography.Text>
                  {parentCustomerId !== undefined
                    ? `已选择：${parentCustomerContextQuery.data?.name ?? `客户 ${parentCustomerId}`}`
                    : parentCustomerAssociationPending
                      ? "正在确认上级客户"
                      : "暂不设置上级客户"}
                </Typography.Text>
                <Button
                  disabled={createMutation.isPending}
                  onClick={() => setParentCustomerPickerOpen(true)}
                >
                  {requestedParentCustomerId === null ? "选择上级客户" : "更换上级客户"}
                </Button>
                {selectedParentCustomer !== null ? (
                  <Button
                    disabled={createMutation.isPending}
                    type="link"
                    onClick={() => setSelectedParentCustomer(null)}
                  >
                    清除已选上级客户
                  </Button>
                ) : null}
              </Space>
            </Card>
          ) : null}
          <CustomerBaseForm
            checkingDuplicate={duplicateMutation.isPending}
            customFieldDefinitions={customFieldDefinitions}
            customFieldDepartmentOptions={customFieldDepartmentQuery.data ?? []}
            customFieldExtra={
              <CustomerCreateFileFieldControls
                definitions={customFieldDefinitions}
                disabled={createMutation.isPending || !canWriteFiles}
                errors={fileFieldErrors}
                filesByField={fileFieldDraft?.filesByField ?? {}}
                uploading={fileFieldUploadMutation.isPending}
                onRemove={(fieldCode, fileId) => {
                  setFileFieldDraft((current) => {
                    if (current === null) return current;
                    return {
                      ...current,
                      filesByField: {
                        ...current.filesByField,
                        [fieldCode]: (current.filesByField[fieldCode] ?? []).filter(
                          (file) => file.fileId !== fileId,
                        ),
                      },
                    };
                  });
                  setFileFieldErrors((current) => {
                    if (current[fieldCode] === undefined) return current;
                    return Object.fromEntries(
                      Object.entries(current).filter(([currentCode]) => currentCode !== fieldCode),
                    );
                  });
                }}
                onUpload={(fieldCode, files) =>
                  fileFieldUploadMutation.mutate({ fieldCode, files })
                }
              />
            }
            customFieldMemberOptions={customFieldMemberQuery.data ?? []}
            customFieldMemberOptionsLoading={customFieldMemberQuery.isLoading}
            includeAddressFields
            includeOwnerSelection
            includeTagSelection
            onCancel={() => navigate("/crm/customers")}
            onCheckDuplicate={(values) => duplicateMutation.mutate(values)}
            onCustomFieldMemberSearch={setCustomFieldMemberKeyword}
            onSecondarySubmit={
              canCreateContacts ? (values) => submit("contact", values) : undefined
            }
            onSubmit={(values) => submit("customer", values)}
            secondarySubmitText={canCreateContacts ? "创建并新建联系人" : undefined}
            submitText="创建客户"
            disabled={
              parentCustomerAssociationPending ||
              createMutation.isPending ||
              fileFieldUploadMutation.isPending ||
              (canReadCustomFieldMetadata &&
                (customFieldDefinitionsQuery.isLoading || customFieldDefinitionsQuery.isError)) ||
              unsupportedRequiredCustomFields.length > 0 ||
              unavailableRequiredCandidateFields.length > 0 ||
              unavailableRequiredFileFields.length > 0
            }
            submitting={createMutation.isPending}
          />
        </main>
      </Modal>
      <Modal
        destroyOnHidden
        footer={null}
        open={parentCustomerPickerOpen}
        title="选择上级客户"
        onCancel={closeParentCustomerPicker}
      >
        <Typography.Paragraph type="secondary">
          候选只来自服务端按当前成员客户读取权限和数据范围裁剪的目录；选择后仍会重新读取详情确认。
        </Typography.Paragraph>
        <Input.Search
          allowClear
          aria-label="搜索可见客户"
          placeholder="搜索可见客户"
          value={parentCustomerKeyword}
          onChange={(event) => setParentCustomerKeyword(event.currentTarget.value)}
        />
        {parentCustomerCandidateQuery.isError ? (
          <Alert
            title={
              parentCustomerCandidateQuery.error instanceof ApiError
                ? parentCustomerCandidateQuery.error.message
                : "客户候选列表暂时无法加载"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : (
          <List
            dataSource={[...(parentCustomerCandidateQuery.data ?? [])]}
            loading={parentCustomerCandidateQuery.isLoading}
            locale={{ emptyText: "未找到可选择客户" }}
            renderItem={(customer) => (
              <List.Item
                actions={[
                  <Button
                    key={customer.id}
                    type="link"
                    onClick={() => chooseParentCustomer(customer)}
                  >
                    选择上级客户
                  </Button>,
                ]}
              >
                <List.Item.Meta description={`客户 ${customer.id}`} title={customer.name} />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </RouteAuthority>
  );
}
