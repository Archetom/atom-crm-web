import { ArrowLeftOutlined } from "@ant-design/icons";
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
  Radio,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import type { Dayjs } from "dayjs";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

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
import { customerContextGlobalListPath } from "~/components/entity-selector/customer-context-create-route";
import { StatusPage } from "~/components/feedback/status-page";
import { toContractListItem, type ContractListItem } from "~/features/contracts";

import {
  invoiceTitleTypeOptions,
  isInvoiceTitleType,
  toInvoiceCreateRequest,
  type InvoiceCreateValues,
  type InvoiceTitleType,
} from "../model/invoice-form";
import { invoiceKeys } from "../model/query-keys";

import styles from "./customer-invoice-create-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

interface InvoiceCreateFormValues {
  amount?: number;
  bankAccount?: string;
  bankName?: string;
  contactName?: string;
  contactPhone?: string;
  invoiceType?: string;
  ownerActorId?: number;
  registeredAddress?: string;
  registeredPhone?: string;
  remark?: string;
  requestedDate?: Dayjs;
  shippingAddress?: string;
  taxNumber?: string;
  title?: string;
  titleType?: InvoiceTitleType;
}

interface InvoiceCreateFileDraftState {
  draft: components["schemas"]["FileFieldDraftResponse"];
  filesByField: CreateFileFieldFiles;
}

const maximumInvoiceAmount = Number.MAX_SAFE_INTEGER;

function dateValue(value: Dayjs | undefined): string | undefined {
  return value?.format("YYYY-MM-DD");
}

function contractLabel(contract: ContractListItem): string {
  const reference = [contract.number, contract.name].filter(
    (value): value is string => value !== null && value.trim().length > 0,
  );
  return reference.length === 0 ? `合同 ${contract.id}` : reference.join(" · ");
}

export function CustomerInvoiceCreatePage() {
  const { customerId: customerIdParam } = useParams();
  const customerId = parseRouteId(customerIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const identityKey = authState?.identityKey ?? "pending";
  const [contractPickerOpen, setContractPickerOpen] = useState(false);
  const [contractKeyword, setContractKeyword] = useState("");
  const [selectedContract, setSelectedContract] = useState<ContractListItem | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<number | null>(null);
  const [memberKeyword, setMemberKeyword] = useState("");
  const [form] = Form.useForm<InvoiceCreateFormValues>();
  const titleType = Form.useWatch("titleType", form);
  const selectedTitleType = isInvoiceTitleType(titleType) ? titleType : "INDIVIDUAL";
  const isOrganizationTitle = selectedTitleType === "ORGANIZATION";
  const canReadInvoices = hasAuthority(authorization, authority.invoicesRead);
  const canReadContracts = hasAuthority(authorization, authority.contractsRead);
  const canReadCustomFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canWriteFiles = hasAuthority(authorization, authority.filesWrite);
  const canSelectOwner =
    hasAuthority(authorization, authority.invoicesAssign) && canReadOrganization;
  const globalReturnPath = customerContextGlobalListPath("/crm/invoices", searchParams.toString());
  const returnPath =
    customerId === null || !canReadInvoices
      ? customerId === null
        ? "/crm/customers"
        : `/crm/customers/${customerId}`
      : (globalReturnPath ?? `/crm/customers/${customerId}/invoices`);
  const contractCandidatesQuery = useQuery({
    queryKey: ["invoice-contract-selector", identityKey, customerId, contractKeyword] as const,
    queryFn: () =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Invoice contract selection is unavailable."))
        : apiClient.getContracts({
            customerId,
            keyword: contractKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: apiClient !== null && customerId !== null && canReadContracts && contractPickerOpen,
  });
  const contractCandidates = contractCandidatesQuery.data
    ? toPageResult(contractCandidatesQuery.data, (value) => {
        const contract = toContractListItem(value);
        return contract?.customerId === customerId ? contract : null;
      }).items
    : [];
  const memberQuery = useQuery({
    queryKey: ["member-selector", "invoice-create-owner", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Invoice owner selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: memberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && canSelectOwner,
  });
  const customFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "INVOICE", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("发票自定义字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("INVOICE"),
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
      "invoice-custom-field-member-selector",
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
    enabled: apiClient !== null && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["invoice-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("发票自定义部门字段的部门目录暂时不可用。"))
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
  const [fileFieldDraft, setFileFieldDraft] = useState<InvoiceCreateFileDraftState | null>(null);
  const [fileFieldErrors, setFileFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const createMutation = useMutation({
    mutationFn: (values: InvoiceCreateValues) =>
      apiClient === null || selectedContract === null
        ? Promise.reject(new Error("Invoice creation is unavailable."))
        : apiClient.createInvoice(toInvoiceCreateRequest(values)).then((invoice) => {
            if (invoice.customerId !== customerId) {
              throw new Error("Invoice creation response does not match the current customer.");
            }
            return invoice;
          }),
    onSuccess: (invoice) => {
      if (canReadInvoices) {
        void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists(identityKey) });
        navigate(`/crm/customers/${invoice.customerId}/invoices/${invoice.id}`, { replace: true });
      } else {
        setCreatedInvoiceId(invoice.id);
      }
    },
  });
  const fileFieldUploadMutation = useMutation({
    mutationFn: async ({ fieldCode, files }: { fieldCode: string; files: readonly File[] }) => {
      if (apiClient === null) throw new Error("发票文件上传暂时不可用。");
      const draft = fileFieldDraft?.draft ?? (await apiClient.createCrmFileFieldDraft("INVOICE"));
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

  function submit(values: InvoiceCreateFormValues) {
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
    const amount = values.amount;
    const invoiceType = values.invoiceType?.trim();
    const requestedDate = dateValue(values.requestedDate);
    const taxNumber = values.taxNumber?.trim();
    const title = values.title?.trim();
    if (
      selectedContract === null ||
      amount === undefined ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > maximumInvoiceAmount ||
      invoiceType === undefined ||
      invoiceType === "" ||
      requestedDate === undefined ||
      !isInvoiceTitleType(values.titleType) ||
      title === undefined ||
      title === "" ||
      (values.ownerActorId !== undefined &&
        (!Number.isSafeInteger(values.ownerActorId) || values.ownerActorId <= 0)) ||
      (values.titleType === "ORGANIZATION" && (taxNumber === undefined || taxNumber === ""))
    ) {
      return;
    }
    createMutation.mutate({
      amount,
      bankAccount: values.bankAccount,
      bankName: values.bankName,
      contactName: values.contactName,
      contactPhone: values.contactPhone,
      contractId: selectedContract.id,
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
      invoiceType,
      ownerActorId: values.ownerActorId,
      registeredAddress: values.registeredAddress,
      registeredPhone: values.registeredPhone,
      remark: values.remark,
      requestedDate,
      shippingAddress: values.shippingAddress,
      taxNumber: values.taxNumber,
      title,
      titleType: values.titleType,
    });
  }

  function closeContractPicker() {
    setContractPickerOpen(false);
    setContractKeyword("");
  }

  if (customerId === null) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.invoicesWrite}>
      <RouteAuthority authority={authority.contractsRead}>
        <RouteAuthority authority={authority.customersRead}>
          <main className={styles.page}>
            <section>
              <Button icon={<ArrowLeftOutlined />} type="link" onClick={() => navigate(returnPath)}>
                返回客户发票
              </Button>
              <Typography.Title level={2}>新建发票申请</Typography.Title>
              <Typography.Text type="secondary">
                填写当前客户中服务端可见合同的发票申请信息；字段目录定义的动态字段和附件会按服务端规则提交。
              </Typography.Text>
            </section>
            {createMutation.isError ? (
              <Alert
                title={
                  createMutation.error instanceof ApiError
                    ? createMutation.error.message
                    : "发票申请暂时无法创建"
                }
                showIcon
                type="error"
              />
            ) : null}
            {customFieldDefinitionsQuery.isError ? (
              <Alert
                description="基础字段仍可填写；如租户配置了必填动态字段，请在字段目录恢复后再提交。"
                title="发票自定义字段暂时无法加载"
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
                    : "发票文件暂时无法上传"
                }
                showIcon
                type="error"
              />
            ) : null}
            {createdInvoiceId !== null ? (
              <Alert
                description="当前成员没有发票读取权限，无法自动打开详情；后续可见范围仍由服务端决定。"
                title={`发票申请已创建，编号 ${createdInvoiceId}`}
                showIcon
                type="success"
              />
            ) : null}
            {canSelectOwner && memberQuery.isError ? (
              <Alert
                title="负责人目录暂时无法加载；可留空后由服务端默认当前成员"
                showIcon
                type="warning"
              />
            ) : null}
            <Form<InvoiceCreateFormValues>
              form={form}
              initialValues={{ titleType: "INDIVIDUAL" }}
              layout="vertical"
              onFinish={submit}
            >
              <Card title="基本信息">
                <div className={styles.fieldGrid}>
                  <Form.Item className={styles.fullWidth} label="关联客户">
                    <Typography.Text>客户 {customerId}</Typography.Text>
                  </Form.Item>
                  <Form.Item className={styles.fullWidth} label="关联合同" required>
                    {selectedContract === null ? (
                      <Typography.Text type="secondary">尚未选择合同</Typography.Text>
                    ) : (
                      <Typography.Text>{contractLabel(selectedContract)}</Typography.Text>
                    )}
                    <div className={styles.contractPickerControls}>
                      <Button
                        disabled={createMutation.isPending}
                        onClick={() => setContractPickerOpen(true)}
                      >
                        选择合同
                      </Button>
                      {selectedContract !== null ? (
                        <Button
                          disabled={createMutation.isPending}
                          onClick={() => setSelectedContract(null)}
                        >
                          清除选择
                        </Button>
                      ) : null}
                    </div>
                  </Form.Item>
                  <Form.Item
                    label="发票金额"
                    name="amount"
                    rules={[
                      { required: true, message: "请输入发票金额" },
                      { type: "number", min: 0.01, message: "发票金额必须大于 0" },
                    ]}
                  >
                    <InputNumber
                      aria-label="发票金额"
                      controls={false}
                      disabled={createMutation.isPending}
                      inputMode="decimal"
                      max={maximumInvoiceAmount}
                      min={0.01}
                      precision={2}
                      step={0.01}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  {canSelectOwner ? (
                    <Form.Item
                      extra="不选择时由服务端默认当前成员。"
                      label="负责人"
                      name="ownerActorId"
                    >
                      <Select
                        allowClear
                        aria-label="负责人"
                        disabled={createMutation.isPending || memberQuery.isError}
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
                  <Form.Item
                    label="申请日期"
                    name="requestedDate"
                    rules={[{ required: true, message: "请选择申请日期" }]}
                  >
                    <DatePicker
                      aria-label="申请日期"
                      disabled={createMutation.isPending}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="发票类型"
                    name="invoiceType"
                    rules={[
                      { required: true, whitespace: true, message: "请输入发票类型" },
                      { max: 50, message: "发票类型不能超过 50 个字符" },
                    ]}
                  >
                    <Input
                      aria-label="发票类型"
                      disabled={createMutation.isPending}
                      maxLength={50}
                      placeholder="例如：增值税普通发票"
                    />
                  </Form.Item>
                  <Form.Item
                    label="抬头类型"
                    name="titleType"
                    rules={[{ required: true, message: "请选择抬头类型" }]}
                  >
                    <Radio.Group
                      aria-label="抬头类型"
                      disabled={createMutation.isPending}
                      options={[...invoiceTitleTypeOptions]}
                    />
                  </Form.Item>
                  <Form.Item
                    className={styles.fullWidth}
                    label="开票抬头"
                    name="title"
                    rules={[
                      { required: true, whitespace: true, message: "请输入开票抬头" },
                      { max: 200, message: "开票抬头不能超过 200 个字符" },
                    ]}
                  >
                    <Input
                      aria-label="开票抬头"
                      disabled={createMutation.isPending}
                      maxLength={200}
                      placeholder={
                        isOrganizationTitle ? "请输入单位开票抬头" : "请输入个人开票抬头"
                      }
                    />
                  </Form.Item>
                </div>
              </Card>
              <Card title="抬头与寄送信息">
                <div className={styles.fieldGrid}>
                  {isOrganizationTitle ? (
                    <>
                      <Form.Item
                        label="纳税人识别号"
                        name="taxNumber"
                        preserve={false}
                        rules={[
                          { required: true, whitespace: true, message: "请输入纳税人识别号" },
                          { max: 100, message: "纳税人识别号不能超过 100 个字符" },
                        ]}
                      >
                        <Input
                          aria-label="纳税人识别号"
                          disabled={createMutation.isPending}
                          maxLength={100}
                        />
                      </Form.Item>
                      <Form.Item label="开户行" name="bankName" preserve={false}>
                        <Input
                          aria-label="开户行"
                          disabled={createMutation.isPending}
                          maxLength={200}
                        />
                      </Form.Item>
                      <Form.Item label="开户账号" name="bankAccount" preserve={false}>
                        <Input
                          aria-label="开户账号"
                          disabled={createMutation.isPending}
                          maxLength={100}
                        />
                      </Form.Item>
                      <Form.Item label="开票地址" name="registeredAddress" preserve={false}>
                        <Input
                          aria-label="开票地址"
                          disabled={createMutation.isPending}
                          maxLength={500}
                        />
                      </Form.Item>
                      <Form.Item label="开票电话" name="registeredPhone" preserve={false}>
                        <Input
                          aria-label="开票电话"
                          disabled={createMutation.isPending}
                          maxLength={50}
                        />
                      </Form.Item>
                    </>
                  ) : null}
                  <Form.Item label="联系人" name="contactName">
                    <Input
                      aria-label="联系人"
                      disabled={createMutation.isPending}
                      maxLength={100}
                    />
                  </Form.Item>
                  <Form.Item label="联系方式" name="contactPhone">
                    <Input
                      aria-label="联系方式"
                      disabled={createMutation.isPending}
                      maxLength={50}
                    />
                  </Form.Item>
                  <Form.Item className={styles.fullWidth} label="邮寄地址" name="shippingAddress">
                    <Input.TextArea
                      aria-label="邮寄地址"
                      autoSize={{ minRows: 2, maxRows: 4 }}
                      disabled={createMutation.isPending}
                      maxLength={500}
                    />
                  </Form.Item>
                  <Form.Item className={styles.fullWidth} label="备注" name="remark">
                    <Input.TextArea
                      aria-label="备注"
                      autoSize={{ minRows: 2, maxRows: 6 }}
                      disabled={createMutation.isPending}
                      maxLength={2000}
                    />
                  </Form.Item>
                  <div className={styles.fullWidth}>
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
                      bindingObjectName="发票申请"
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
                  </div>
                </div>
                <Typography.Paragraph type="secondary">
                  服务端会重新校验合同和客户可见性、可开票金额、抬头、动态字段、附件写入权限与负责人范围；提交失败不会自动重试。
                </Typography.Paragraph>
              </Card>
              <Space>
                <Button disabled={createMutation.isPending} onClick={() => navigate(returnPath)}>
                  取消
                </Button>
                <Button
                  disabled={
                    selectedContract === null ||
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
                  创建发票申请
                </Button>
              </Space>
            </Form>
          </main>
          <Modal
            footer={null}
            open={contractPickerOpen}
            title="选择关联合同"
            onCancel={closeContractPicker}
          >
            <Typography.Paragraph type="secondary">
              仅显示服务端当前可见且明确属于此客户的合同；不能手动输入合同 ID。
            </Typography.Paragraph>
            <Input.Search
              allowClear
              placeholder="按合同名称或编号搜索"
              value={contractKeyword}
              onChange={(event) => setContractKeyword(event.target.value)}
              onSearch={(keyword) => setContractKeyword(keyword)}
            />
            {contractCandidatesQuery.isError ? (
              <Alert title="关联合同暂时无法加载" showIcon type="error" />
            ) : (
              <List
                dataSource={contractCandidates}
                loading={contractCandidatesQuery.isLoading}
                locale={{ emptyText: "暂无可选择合同" }}
                renderItem={(contract) => (
                  <List.Item
                    actions={[
                      <Button
                        key="select"
                        onClick={() => {
                          setSelectedContract(contract);
                          closeContractPicker();
                        }}
                      >
                        选择
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      description={
                        contract.status === null ? undefined : `状态：${contract.status}`
                      }
                      title={contractLabel(contract)}
                    />
                  </List.Item>
                )}
              />
            )}
          </Modal>
        </RouteAuthority>
      </RouteAuthority>
    </RouteAuthority>
  );
}
