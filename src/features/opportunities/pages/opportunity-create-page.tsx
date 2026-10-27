import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import type { Dayjs } from "dayjs";
import { useState } from "react";
import { useNavigate } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import type { components } from "~/api/generated/schema";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { toPageResult } from "~/components/data-view/pagination";
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
import { toContactListItem } from "~/features/contacts";

import {
  maximumOpportunityEstimatedAmount,
  toOpportunityCreateRequest,
  type OpportunityCreateValues,
} from "../model/opportunity-form";
import { opportunityKeys } from "../model/query-keys";

import styles from "./opportunity-create-page.module.css";

interface OpportunityCreateFormValues {
  contactIds?: number[];
  customerId?: number;
  description?: string;
  estimatedAmount?: number;
  expectedCloseDate?: Dayjs;
  name?: string;
  nextContactTime?: Dayjs;
  ownerActorId?: number;
  pipelineId?: number;
  primaryContactId?: number;
  stageCode?: string;
}

interface SelectedContact {
  id: number;
  name: string;
}

interface OpportunityCreateFileDraftState {
  draft: components["schemas"]["FileFieldDraftResponse"];
  filesByField: CreateFileFieldFiles;
}

function dateValue(value: Dayjs | undefined): string | undefined {
  return value?.format("YYYY-MM-DD");
}

function dateTimeValue(value: Dayjs | undefined): string | undefined {
  return value?.format("YYYY-MM-DDTHH:mm:ss");
}

export function OpportunityCreatePage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<OpportunityCreateFormValues>();
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactKeyword, setContactKeyword] = useState("");
  const [createdOpportunityId, setCreatedOpportunityId] = useState<number | null>(null);
  const [memberKeyword, setMemberKeyword] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<readonly SelectedContact[]>([]);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadContacts = hasAuthority(authorization, authority.contactsRead);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const canReadPipelines = hasAuthority(authorization, authority.opportunityPipelinesRead);
  const canReadOpportunities = hasAuthority(authorization, authority.opportunitiesRead);
  const canReadCustomFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canWriteFiles = hasAuthority(authorization, authority.filesWrite);
  const canSelectOwner =
    hasAuthority(authorization, authority.opportunitiesAssign) && canReadOrganization;
  const canSelectCreatePrerequisites = canReadCustomers && canReadPipelines;
  const selectedPipelineId = Form.useWatch("pipelineId", form);
  const selectedCustomerId = Form.useWatch("customerId", form);
  const customerCandidateQuery = useQuery({
    queryKey: ["opportunity-customer-selector", identityKey, customerKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer selection is unavailable."))
        : apiClient.getVisibleCustomers({
            page: 1,
            size: 50,
            keyword: customerKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && customerPickerOpen && canReadCustomers,
  });
  const pipelineQuery = useQuery({
    queryKey: ["opportunity-pipeline-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity pipeline selection is unavailable."))
        : apiClient.getOpportunityPipelines({ page: 1, size: 100, status: "ACTIVE" }),
    enabled: apiClient !== null && canReadPipelines,
  });
  const memberQuery = useQuery({
    queryKey: ["member-selector", "opportunity-create-owner", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity owner selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: memberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && canSelectOwner,
  });
  const customFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "OPPORTUNITY", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("商机字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("OPPORTUNITY"),
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
      "opportunity-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("商机自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: apiClient !== null && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["opportunity-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("商机自定义部门字段的部门目录暂时不可用。"))
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
  const [fileFieldDraft, setFileFieldDraft] = useState<OpportunityCreateFileDraftState | null>(
    null,
  );
  const [fileFieldErrors, setFileFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const contactCandidateQuery = useQuery({
    queryKey: [
      "opportunity-contact-selector",
      identityKey,
      selectedCustomerId ?? 0,
      contactKeyword,
    ] as const,
    queryFn: () => {
      if (apiClient === null || selectedCustomerId === undefined) {
        return Promise.reject(new Error("Opportunity contact selection is unavailable."));
      }
      return apiClient
        .getContacts({
          customerId: selectedCustomerId,
          keyword: contactKeyword.trim() || undefined,
          page: 1,
          size: 50,
        })
        .then((pager) =>
          toPageResult(pager, toContactListItem).items.flatMap((contact) =>
            contact.customerId === selectedCustomerId && contact.id > 0
              ? [{ id: contact.id, name: contact.name }]
              : [],
          ),
        );
    },
    enabled:
      apiClient !== null &&
      contactPickerOpen &&
      canReadContacts &&
      selectedCustomerId !== undefined &&
      Number.isSafeInteger(selectedCustomerId) &&
      selectedCustomerId > 0,
  });
  const selectedPipeline = pipelineQuery.data?.find(
    (pipeline) => pipeline.id === selectedPipelineId,
  );
  const stageQuery = useQuery({
    queryKey:
      selectedPipeline === undefined
        ? (["opportunity-stage-selector", identityKey, 0] as const)
        : (["opportunity-stage-selector", identityKey, selectedPipeline.id] as const),
    queryFn: () =>
      apiClient === null || selectedPipeline === undefined
        ? Promise.reject(new Error("Opportunity stage selection is unavailable."))
        : apiClient.getOpportunityPipelineStages(selectedPipeline.id, {
            page: 1,
            size: 100,
            status: "ACTIVE",
          }),
    enabled: apiClient !== null && selectedPipeline !== undefined && canReadPipelines,
  });
  const selectedCustomer = customerCandidateQuery.data?.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const createMutation = useMutation({
    mutationFn: (values: OpportunityCreateValues) =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity creation is unavailable."))
        : apiClient.createOpportunity(toOpportunityCreateRequest(values)),
    onSuccess: (opportunity) => {
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
      queryClient.setQueryData(opportunityKeys.detail(identityKey, opportunity.id), opportunity);
      if (canReadOpportunities) {
        navigate(`/crm/opportunities/${opportunity.id}`, { replace: true });
      } else {
        setCreatedOpportunityId(opportunity.id);
      }
    },
  });
  const fileFieldUploadMutation = useMutation({
    mutationFn: async ({ fieldCode, files }: { fieldCode: string; files: readonly File[] }) => {
      if (apiClient === null) throw new Error("商机文件上传暂时不可用。");
      const draft =
        fileFieldDraft?.draft ?? (await apiClient.createCrmFileFieldDraft("OPPORTUNITY"));
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

  function chooseCustomer(customerId: number) {
    if (form.getFieldValue("customerId") !== customerId) {
      form.setFieldsValue({ contactIds: undefined, customerId, primaryContactId: undefined });
      setSelectedContacts([]);
    }
    closeCustomerPicker();
  }

  function closeContactPicker() {
    setContactPickerOpen(false);
    setContactKeyword("");
  }

  function addContact(contact: SelectedContact) {
    setSelectedContacts((current) => {
      if (current.some((item) => item.id === contact.id)) return current;
      const next = [...current, contact];
      form.setFieldValue(
        "contactIds",
        next.map((item) => item.id),
      );
      return next;
    });
  }

  function removeContact(contactId: number) {
    setSelectedContacts((current) => {
      const next = current.filter((item) => item.id !== contactId);
      form.setFieldValue(
        "contactIds",
        next.map((item) => item.id),
      );
      if (form.getFieldValue("primaryContactId") === contactId) {
        form.setFieldValue("primaryContactId", undefined);
      }
      return next;
    });
  }

  function submit(values: OpportunityCreateFormValues) {
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
    const pipeline = pipelineQuery.data?.find((item) => item.id === values.pipelineId);
    const contactIds = values.contactIds?.filter(
      (contactId): contactId is number =>
        Number.isSafeInteger(contactId) &&
        contactId > 0 &&
        selectedContacts.some((item) => item.id === contactId),
    );
    const primaryContactId =
      values.primaryContactId !== undefined && contactIds?.includes(values.primaryContactId)
        ? values.primaryContactId
        : undefined;
    if (
      values.name === undefined ||
      values.customerId === undefined ||
      pipeline === undefined ||
      values.stageCode === undefined ||
      (values.estimatedAmount !== undefined &&
        (!Number.isFinite(values.estimatedAmount) ||
          values.estimatedAmount < 0 ||
          values.estimatedAmount > maximumOpportunityEstimatedAmount)) ||
      (values.ownerActorId !== undefined &&
        (!Number.isSafeInteger(values.ownerActorId) || values.ownerActorId <= 0))
    ) {
      return;
    }
    createMutation.mutate({
      contactIds,
      customerId: values.customerId,
      customFields: toCustomFieldFormValues(customFieldDefinitions, customFieldValues),
      description: values.description,
      estimatedAmount: values.estimatedAmount,
      expectedCloseDate: dateValue(values.expectedCloseDate),
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
      name: values.name,
      nextContactTime: dateTimeValue(values.nextContactTime),
      ownerActorId: values.ownerActorId,
      pipelineCode: pipeline.code,
      primaryContactId,
      stageCode: values.stageCode,
    });
  }

  return (
    <RouteAuthority authority={authority.opportunitiesWrite}>
      <main className={styles.page}>
        <section>
          <Typography.Title level={2}>新建商机</Typography.Title>
          <Typography.Text type="secondary">
            客户、管线和阶段只从服务端当前可见的活动目录选择；服务端仍会复核字段权限、数据范围与活动状态。
          </Typography.Text>
        </section>
        {!canSelectCreatePrerequisites ? (
          <Alert
            description="后端创建商机时会读取客户范围；为避免猜测管线或阶段，前端还需要读取销售管线目录。请联系管理员补充所需权限。"
            title="缺少创建商机所需的服务端目录权限"
            showIcon
            type="warning"
          />
        ) : null}
        {pipelineQuery.isError ? (
          <Alert title="销售管线目录暂时无法加载" showIcon type="error" />
        ) : null}
        {customFieldDefinitionsQuery.isError ? (
          <Alert
            description="基础字段仍可填写；如租户配置了必填动态字段，请在字段目录恢复后再提交。"
            title="商机自定义字段暂时无法加载"
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
                : "商机文件暂时无法上传"
            }
            showIcon
            type="error"
          />
        ) : null}
        {canSelectOwner && memberQuery.isError ? (
          <Alert
            title="负责人目录暂时无法加载；可留空后由服务端默认当前成员"
            showIcon
            type="warning"
          />
        ) : null}
        {createMutation.isError ? (
          <Alert
            title={
              createMutation.error instanceof ApiError
                ? createMutation.error.message
                : "商机暂时无法创建"
            }
            showIcon
            type="error"
          />
        ) : null}
        {createdOpportunityId !== null ? (
          <Alert
            description="当前成员没有商机读取权限，无法自动打开详情；是否可读取和后续展示范围仍由服务端决定。"
            title={`商机已创建，编号 ${createdOpportunityId}`}
            showIcon
            type="success"
          />
        ) : null}
        <Card title="基本信息">
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item
              label="商机名称"
              name="name"
              rules={[
                { required: true, whitespace: true, message: "请输入商机名称" },
                { max: 200, message: "商机名称不能超过 200 个字符" },
              ]}
            >
              <Input aria-label="商机名称" maxLength={200} placeholder="请输入商机名称" />
            </Form.Item>
            <Form.Item name="customerId" rules={[{ required: true, message: "请选择关联客户" }]}>
              <Input type="hidden" />
            </Form.Item>
            <Form.Item label="关联客户" required>
              <Space wrap>
                <Typography.Text>
                  {selectedCustomer === undefined
                    ? selectedCustomerId === undefined
                      ? "尚未选择客户"
                      : `已选择客户 ${selectedCustomerId}`
                    : `${selectedCustomer.name}（客户 ${selectedCustomer.id}）`}
                </Typography.Text>
                <Button disabled={!canReadCustomers} onClick={() => setCustomerPickerOpen(true)}>
                  选择客户
                </Button>
              </Space>
            </Form.Item>
            <Form.Item hidden name="contactIds">
              <Input type="hidden" />
            </Form.Item>
            {canReadContacts ? (
              <>
                <Form.Item
                  extra="联系人只从当前所选客户的服务端可见目录选择；不选择时不创建关联。"
                  label="关联联系人（可选）"
                >
                  <Space orientation="vertical" size="small" style={{ width: "100%" }}>
                    {selectedContacts.length === 0 ? (
                      <Typography.Text type="secondary">尚未选择联系人</Typography.Text>
                    ) : (
                      <List
                        bordered
                        dataSource={[...selectedContacts]}
                        renderItem={(contact) => (
                          <List.Item
                            actions={[
                              <Button
                                key={contact.id}
                                type="link"
                                onClick={() => removeContact(contact.id)}
                              >
                                移除
                              </Button>,
                            ]}
                          >
                            {contact.name}
                          </List.Item>
                        )}
                        size="small"
                      />
                    )}
                    <Button
                      disabled={
                        selectedCustomerId === undefined ||
                        !Number.isSafeInteger(selectedCustomerId) ||
                        selectedCustomerId <= 0
                      }
                      onClick={() => setContactPickerOpen(true)}
                    >
                      选择联系人
                    </Button>
                  </Space>
                </Form.Item>
                {selectedContacts.length > 0 ? (
                  <Form.Item label="首要联系人（可选）" name="primaryContactId">
                    <Select
                      allowClear
                      aria-label="首要联系人"
                      options={selectedContacts.map((contact) => ({
                        label: contact.name,
                        value: contact.id,
                      }))}
                      placeholder="从已关联联系人中选择"
                    />
                  </Form.Item>
                ) : null}
              </>
            ) : null}
            <Form.Item label="预计成交日期" name="expectedCloseDate">
              <DatePicker aria-label="预计成交日期" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              label="预计成交金额"
              name="estimatedAmount"
              rules={[
                {
                  type: "number",
                  min: 0,
                  max: maximumOpportunityEstimatedAmount,
                  message: "请输入有效的非负预计成交金额",
                },
              ]}
            >
              <InputNumber
                aria-label="预计成交金额"
                min={0}
                max={maximumOpportunityEstimatedAmount}
                precision={2}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item label="下次联系时间" name="nextContactTime">
              <DatePicker aria-label="下次联系时间" showTime style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              label="商机说明"
              name="description"
              rules={[{ max: 2000, message: "商机说明不能超过 2000 个字符" }]}
            >
              <Input.TextArea aria-label="商机说明" maxLength={2000} rows={4} />
            </Form.Item>
            <Form.Item
              label="销售管线"
              name="pipelineId"
              rules={[{ required: true, message: "请选择销售管线" }]}
            >
              <Select
                aria-label="销售管线"
                disabled={!canReadPipelines || pipelineQuery.isLoading || pipelineQuery.isError}
                loading={pipelineQuery.isLoading}
                options={(pipelineQuery.data ?? []).map((pipeline) => ({
                  label: `${pipeline.name}（${pipeline.code}）`,
                  value: pipeline.id,
                }))}
                placeholder="请选择活动销售管线"
                onChange={() => form.setFieldValue("stageCode", undefined)}
              />
            </Form.Item>
            <Form.Item
              label="销售阶段"
              name="stageCode"
              rules={[{ required: true, message: "请选择销售阶段" }]}
            >
              <Select
                aria-label="销售阶段"
                disabled={
                  selectedPipeline === undefined || stageQuery.isLoading || stageQuery.isError
                }
                loading={stageQuery.isLoading}
                options={(stageQuery.data ?? []).map((stage) => ({
                  label: `${stage.name}（${stage.code}）`,
                  value: stage.code,
                }))}
                placeholder="请选择活动销售阶段"
              />
            </Form.Item>
            {canSelectOwner ? (
              <Form.Item extra="不选择时由服务端默认当前成员。" label="负责人" name="ownerActorId">
                <Select
                  allowClear
                  aria-label="负责人"
                  disabled={memberQuery.isError}
                  filterOption={false}
                  loading={memberQuery.isLoading}
                  notFoundContent={
                    memberQuery.isLoading ? <Spin size="small" /> : "未找到可选择成员"
                  }
                  options={(memberQuery.data ?? []).map((member) => ({
                    label: member.displayName,
                    value: member.actorId,
                  }))}
                  placeholder="从服务端成员目录选择"
                  showSearch
                  onSearch={setMemberKeyword}
                />
              </Form.Item>
            ) : null}
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
              bindingObjectName="商机"
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
              onUpload={(fieldCode, files) => fileFieldUploadMutation.mutate({ fieldCode, files })}
            />
            {stageQuery.isError ? (
              <Alert title="销售阶段暂时无法加载" showIcon type="error" />
            ) : null}
            <Space>
              <Button onClick={() => navigate("/crm/opportunities")}>取消</Button>
              <Button
                disabled={
                  !canSelectCreatePrerequisites ||
                  pipelineQuery.isError ||
                  stageQuery.isError ||
                  fileFieldUploadMutation.isPending ||
                  (canReadCustomFieldMetadata &&
                    (customFieldDefinitionsQuery.isLoading ||
                      customFieldDefinitionsQuery.isError)) ||
                  unsupportedRequiredCustomFields.length > 0 ||
                  unavailableRequiredCandidateFields.length > 0 ||
                  unavailableRequiredFileFields.length > 0
                }
                htmlType="submit"
                loading={createMutation.isPending}
                type="primary"
              >
                创建商机
              </Button>
            </Space>
          </Form>
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
          候选客户只来自服务端当前成员可见范围；创建时服务端会再次校验客户关联与字段写权限。
        </Typography.Paragraph>
        <Input.Search
          allowClear
          defaultValue={customerKeyword}
          placeholder="搜索可见客户"
          onSearch={(keyword) => setCustomerKeyword(keyword)}
        />
        {customerCandidateQuery.isError ? (
          <Alert title="客户候选列表暂时无法加载" showIcon style={{ marginTop: 12 }} type="error" />
        ) : (
          <List
            dataSource={[...(customerCandidateQuery.data ?? [])]}
            loading={customerCandidateQuery.isLoading}
            locale={{ emptyText: "未找到可选择客户" }}
            renderItem={(customer) => (
              <List.Item
                actions={[
                  <Button key={customer.id} type="link" onClick={() => chooseCustomer(customer.id)}>
                    选择
                  </Button>,
                ]}
              >
                <List.Item.Meta description={`客户 ${customer.id}`} title={customer.name} />
              </List.Item>
            )}
          />
        )}
      </Modal>
      <Modal
        destroyOnHidden
        footer={<Button onClick={closeContactPicker}>完成</Button>}
        open={contactPickerOpen}
        title="选择关联联系人"
        onCancel={closeContactPicker}
      >
        <Typography.Paragraph type="secondary">
          候选联系人仅来自当前所选客户、当前成员可见的服务端目录；创建时服务端会再次校验联系人可见性与字段写权限。
        </Typography.Paragraph>
        <Input.Search
          allowClear
          defaultValue={contactKeyword}
          placeholder="按联系人姓名搜索"
          onSearch={(keyword) => setContactKeyword(keyword)}
        />
        {contactCandidateQuery.isError ? (
          <Alert
            title="联系人候选列表暂时无法加载"
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : (
          <List
            dataSource={[...(contactCandidateQuery.data ?? [])]}
            loading={contactCandidateQuery.isLoading}
            locale={{ emptyText: "未找到可选择联系人" }}
            renderItem={(contact) => {
              const selected = selectedContacts.some((item) => item.id === contact.id);
              return (
                <List.Item
                  actions={[
                    <Button
                      key={contact.id}
                      disabled={selected}
                      type="link"
                      onClick={() => addContact(contact)}
                    >
                      {selected ? "已选择" : "选择"}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta description={`联系人 ${contact.id}`} title={contact.name} />
                </List.Item>
              );
            }}
          />
        )}
      </Modal>
    </RouteAuthority>
  );
}
