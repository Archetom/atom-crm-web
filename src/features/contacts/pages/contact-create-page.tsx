import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Input, List, Modal, Space, Typography } from "antd";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import type { components } from "~/api/generated/schema";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  CreateFileFieldControls,
  CustomFieldFormFields,
  createFieldMetadataQueryKeys,
  customFileFieldDefinitions,
  customFieldFormDefinitions,
  toCustomFieldFormValues,
  unsupportedRequiredCustomFieldDefinitions,
  validateCustomFieldFormValues,
  type CreateFileFieldFiles,
  type CustomFieldValues,
} from "~/components/dynamic-field";
import type { CustomerOption } from "~/components/entity-selector/customer-option";

import { ContactBaseForm } from "../components/contact-base-form";
import {
  toContactCreateRequest,
  toContactDuplicateCheckRequest,
  type ContactBaseFormValues,
} from "../model/contact-form";
import { contactKeys } from "../model/query-keys";
import { contactCreateRouteContextFromSearch } from "../model/contact-create-route";

import styles from "./contact-create-page.module.css";

interface ContactCreateFileDraftState {
  draft: components["schemas"]["FileFieldDraftResponse"];
  filesByField: CreateFileFieldFiles;
}

export function ContactCreatePage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const identityKey = authState?.identityKey ?? "pending";
  const routeContext = contactCreateRouteContextFromSearch(searchParams.toString());
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const canReadCustomFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canWriteFiles = hasAuthority(authorization, authority.filesWrite);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const requestedCustomerId = selectedCustomer?.id ?? routeContext.customerId;
  const customerContextQuery = useQuery({
    queryKey: ["contact-create-customer", identityKey, requestedCustomerId] as const,
    queryFn: () =>
      apiClient === null || requestedCustomerId === null
        ? Promise.reject(new Error("Customer context is unavailable."))
        : apiClient.getCustomer(requestedCustomerId),
    enabled: apiClient !== null && requestedCustomerId !== null && canReadCustomers,
  });
  const customerId =
    customerContextQuery.data?.id === requestedCustomerId
      ? customerContextQuery.data.id
      : undefined;
  const customerAssociationPending = requestedCustomerId !== null && customerId === undefined;
  const returnPath =
    selectedCustomer === null && customerId === routeContext.customerId
      ? (routeContext.returnPath ?? "/crm/contacts")
      : "/crm/contacts";
  const customerCandidateQuery = useQuery({
    queryKey: ["contact-create-customer-selector", identityKey, customerKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer selection is unavailable."))
        : apiClient.getVisibleCustomers({
            keyword: customerKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: apiClient !== null && customerPickerOpen && canReadCustomers,
  });
  const customFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "CONTACT", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("联系人字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("CONTACT"),
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
      "contact-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("联系人自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: apiClient !== null && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["contact-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("联系人自定义部门字段的部门目录暂时不可用。"))
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
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [customFieldErrors, setCustomFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [fileFieldDraft, setFileFieldDraft] = useState<ContactCreateFileDraftState | null>(null);
  const [fileFieldErrors, setFileFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const createMutation = useMutation({
    mutationFn: ({
      additionalValues,
      customerId: associatedCustomerId,
      values,
    }: {
      additionalValues?: {
        customFields: CustomFieldValues;
        fileFieldSubmission?: {
          draftId: number;
          fields: Readonly<Record<string, readonly number[]>>;
        };
      };
      customerId?: number;
      values: ContactBaseFormValues;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("Contact creation is unavailable."))
        : apiClient.createContact(
            toContactCreateRequest(values, associatedCustomerId, additionalValues),
          ),
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
      queryClient.setQueryData(contactKeys.detail(identityKey, contact.id), contact);
      navigate(`/crm/contacts/${contact.id}`, { replace: true });
    },
  });
  const duplicateMutation = useMutation({
    mutationFn: (values: ContactBaseFormValues) =>
      apiClient === null
        ? Promise.reject(new Error("Contact duplicate check is unavailable."))
        : apiClient.checkContactDuplicate(toContactDuplicateCheckRequest(values)),
  });
  const fileFieldUploadMutation = useMutation({
    mutationFn: async ({ fieldCode, files }: { fieldCode: string; files: readonly File[] }) => {
      if (apiClient === null) throw new Error("联系人文件上传暂时不可用。");
      const draft = fileFieldDraft?.draft ?? (await apiClient.createCrmFileFieldDraft("CONTACT"));
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

  function closeCustomerPicker() {
    setCustomerPickerOpen(false);
    setCustomerKeyword("");
  }

  function chooseCustomer(customer: CustomerOption) {
    setSelectedCustomer(customer);
    closeCustomerPicker();
  }

  function submit(values: ContactBaseFormValues) {
    if (requestedCustomerId !== null && customerId !== requestedCustomerId) return;
    const customFieldIssues = validateCustomFieldFormValues(
      customFieldDefinitions,
      customFieldValues,
    );
    setCustomFieldErrors(
      Object.fromEntries(customFieldIssues.map((issue) => [issue.code, issue.message])),
    );
    if (customFieldIssues.length > 0) return;
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
      additionalValues: {
        customFields: toCustomFieldFormValues(customFieldDefinitions, customFieldValues),
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
      },
      customerId,
      values,
    });
  }

  return (
    <RouteAuthority authority={authority.contactsWrite}>
      <main className={styles.page}>
        <section>
          <Typography.Title level={2}>新建联系人</Typography.Title>
          <Typography.Text type="secondary">
            基础字段及已确认的关联客户由服务端执行最终字段权限、数据范围和业务校验。
          </Typography.Text>
        </section>
        {requestedCustomerId !== null && !canReadCustomers ? (
          <Alert
            description="当前链接包含客户上下文，但缺少客户读取权限，无法安全确认后创建关联联系人。请返回后检查权限。"
            title="无法确认关联客户"
            showIcon
            type="warning"
          />
        ) : null}
        {customerContextQuery.isError ? (
          <Alert
            description="关联客户可能已不可见或已变更。为避免写入未经确认的关系，当前不会创建联系人。"
            title="关联客户暂时无法确认"
            showIcon
            type="error"
          />
        ) : null}
        {customerId !== undefined ? (
          <Alert
            description="此关系只来自当前身份下服务端确认的客户详情；创建请求仅提交其 ID，服务端会再次复核可见性。"
            title={`将关联到客户：${customerContextQuery.data?.name ?? `客户 ${customerId}`}`}
            showIcon
            type="info"
          />
        ) : null}
        {customFieldDefinitionsQuery.isError ? (
          <Alert
            description="基础字段仍可填写；如租户配置了必填动态字段，请在字段目录恢复后再提交。"
            title="联系人自定义字段暂时无法加载"
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
                : "联系人文件暂时无法上传"
            }
            showIcon
            type="error"
          />
        ) : null}
        {canReadCustomers ? (
          <Card size="small" title="关联客户（可选）">
            <Space wrap>
              <Typography.Text>
                {customerId !== undefined
                  ? `已关联：${customerContextQuery.data?.name ?? `客户 ${customerId}`}`
                  : customerAssociationPending
                    ? "正在确认关联客户"
                    : "暂不关联客户"}
              </Typography.Text>
              <Button
                disabled={createMutation.isPending}
                onClick={() => setCustomerPickerOpen(true)}
              >
                {requestedCustomerId === null ? "选择客户" : "更换客户"}
              </Button>
              {selectedCustomer !== null ? (
                <Button
                  disabled={createMutation.isPending}
                  type="link"
                  onClick={() => setSelectedCustomer(null)}
                >
                  清除已选客户
                </Button>
              ) : null}
            </Space>
          </Card>
        ) : null}
        {createMutation.isError ? (
          <Alert
            title={
              createMutation.error instanceof ApiError
                ? createMutation.error.message
                : "联系人暂时无法创建"
            }
            showIcon
            type="error"
          />
        ) : null}
        {duplicateMutation.isError ? (
          <Alert
            title={
              duplicateMutation.error instanceof ApiError
                ? duplicateMutation.error.message
                : "联系人暂时无法查重"
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
                ? "发现当前可见范围内存在重复联系人，请核对后再创建。"
                : "当前可见范围内未发现重复联系人。"
            }
            showIcon
            type={duplicateMutation.data ? "warning" : "success"}
          />
        ) : null}
        <Card title="基本信息">
          <ContactBaseForm
            checkingDuplicate={duplicateMutation.isPending}
            disabled={
              customerAssociationPending ||
              createMutation.isPending ||
              fileFieldUploadMutation.isPending ||
              (canReadCustomFieldMetadata &&
                (customFieldDefinitionsQuery.isLoading || customFieldDefinitionsQuery.isError)) ||
              unsupportedRequiredCustomFields.length > 0 ||
              unavailableRequiredCandidateFields.length > 0 ||
              unavailableRequiredFileFields.length > 0
            }
            includeAddressFields
            formExtra={
              <>
                <CustomFieldFormFields
                  definitions={customFieldDefinitions}
                  departmentOptions={customFieldDepartmentQuery.data ?? []}
                  disabled={createMutation.isPending || fileFieldUploadMutation.isPending}
                  errors={customFieldErrors}
                  memberOptions={customFieldMemberQuery.data ?? []}
                  memberOptionsLoading={customFieldMemberQuery.isLoading}
                  values={customFieldValues}
                  onChange={setCustomFieldValues}
                  onFieldChange={(code) => {
                    setCustomFieldErrors((current) => {
                      if (current[code] === undefined) return current;
                      return Object.fromEntries(
                        Object.entries(current).filter(([currentCode]) => currentCode !== code),
                      );
                    });
                  }}
                  onMemberSearch={setCustomFieldMemberKeyword}
                />
                <CreateFileFieldControls
                  bindingObjectName="联系人"
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
                        Object.entries(current).filter(
                          ([currentCode]) => currentCode !== fieldCode,
                        ),
                      );
                    });
                  }}
                  onUpload={(fieldCode, files) =>
                    fileFieldUploadMutation.mutate({ fieldCode, files })
                  }
                />
              </>
            }
            includeNextContactTime
            includeOwnerSelection
            includeTagSelection
            onCancel={() => navigate(returnPath)}
            onCheckDuplicate={(values) => duplicateMutation.mutate(values)}
            onSubmit={submit}
            submitText="创建联系人"
            submitting={createMutation.isPending}
          />
        </Card>
      </main>
      <Modal
        destroyOnHidden
        footer={null}
        open={customerPickerOpen}
        title="选择关联客户"
        onCancel={closeCustomerPicker}
      >
        <Typography.Paragraph type="secondary">
          候选只来自服务端按当前成员客户读取权限和数据范围裁剪的目录；选择后仍会重新读取详情确认。
        </Typography.Paragraph>
        <Input.Search
          allowClear
          aria-label="搜索可见客户"
          placeholder="搜索可见客户"
          value={customerKeyword}
          onChange={(event) => setCustomerKeyword(event.currentTarget.value)}
        />
        {customerCandidateQuery.isError ? (
          <Alert
            title={
              customerCandidateQuery.error instanceof ApiError
                ? customerCandidateQuery.error.message
                : "客户候选列表暂时无法加载"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : (
          <List
            dataSource={[...(customerCandidateQuery.data ?? [])]}
            loading={customerCandidateQuery.isLoading}
            locale={{ emptyText: "未找到可选择客户" }}
            renderItem={(customer) => (
              <List.Item
                actions={[
                  <Button key={customer.id} type="link" onClick={() => chooseCustomer(customer)}>
                    选择客户
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
