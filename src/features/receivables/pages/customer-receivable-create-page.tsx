import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
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
import {
  customerContextReceivableRequestedPlanId,
  customerContextReceivableReturnPath,
} from "~/components/entity-selector/customer-context-create-route";
import { StatusPage } from "~/components/feedback/status-page";
import { toContractListItem, type ContractListItem } from "~/features/contracts";
import { receivablePlanKeys } from "~/features/receivable-plans";
import { type ReceivablePlanSelectionItem } from "~/features/receivable-plans";

import {
  toReceivableCreateRequest,
  type ReceivableFileFieldSubmission,
} from "../model/receivable-form";
import { receivableKeys } from "../model/query-keys";

import styles from "./customer-receivable-create-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

interface ReceivableCreateFormValues {
  amount?: number;
  ownerActorId?: number;
  paymentMethod?: string;
  receivedDate?: string;
  remark?: string;
}

interface ReceivableCreateSubmitValues {
  amount: number;
  customFields?: CustomFieldValues;
  fileFieldSubmission?: ReceivableFileFieldSubmission;
  ownerActorId?: number;
  paymentMethod: string;
  receivablePlanId?: number;
  receivedDate: string;
  remark?: string;
}

interface ReceivableCreateFileDraftState {
  draft: components["schemas"]["FileFieldDraftResponse"];
  filesByField: CreateFileFieldFiles;
}

interface ReceivableContractSelection {
  customerId: number;
  id: number;
  name: string | null;
  number: string | null;
  status: string | null;
}

function contractLabel(contract: ReceivableContractSelection): string {
  const reference = [contract.number, contract.name].filter(
    (value): value is string => value !== null && value.trim().length > 0,
  );
  return reference.length === 0 ? `合同 ${contract.id}` : reference.join(" · ");
}

function toReceivableContractSelection(contract: ContractListItem): ReceivableContractSelection {
  return {
    customerId: contract.customerId,
    id: contract.id,
    name: contract.name,
    number: contract.number,
    status: contract.status,
  };
}

function planLabel(plan: ReceivablePlanSelectionItem): string {
  return plan.installment === null ? `回款计划 ${plan.id}` : `第 ${plan.installment} 期`;
}

function isDate(value: string | undefined): value is string {
  return value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function CustomerReceivableCreatePage() {
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
  const [selectedContract, setSelectedContract] = useState<ReceivableContractSelection | null>(
    null,
  );
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ReceivablePlanSelectionItem | null>(null);
  const [hasManualRelationSelection, setHasManualRelationSelection] = useState(false);
  const [createdReceivableId, setCreatedReceivableId] = useState<number | null>(null);
  const [memberKeyword, setMemberKeyword] = useState("");
  const canReadReceivables = hasAuthority(authorization, authority.receivablesRead);
  const canReadContracts = hasAuthority(authorization, authority.contractsRead);
  const canReadReceivablePlans = hasAuthority(authorization, authority.receivablePlansRead);
  const canReadCustomFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canWriteFiles = hasAuthority(authorization, authority.filesWrite);
  const canSelectOwner =
    hasAuthority(authorization, authority.receivablesAssign) && canReadOrganization;
  const createSearch = searchParams.toString();
  const requestedPlanId = customerContextReceivableRequestedPlanId(createSearch);
  const globalReturnPath = customerContextReceivableReturnPath(createSearch);
  const returnPath =
    customerId === null || !canReadReceivables
      ? customerId === null
        ? "/crm/customers"
        : `/crm/customers/${customerId}`
      : (globalReturnPath ?? `/crm/customers/${customerId}/receivables`);
  const returnLabel =
    globalReturnPath === null
      ? "返回客户回款"
      : searchParams.get("returnTarget") === "receivable-plans"
        ? "返回回款计划管理"
        : "返回回款管理";
  const contractCandidatesQuery = useQuery({
    queryKey: ["receivable-contract-selector", identityKey, customerId, contractKeyword] as const,
    queryFn: () =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Receivable contract selection is unavailable."))
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
  const requestedPlanQuery = useQuery({
    queryKey: [
      "receivable-create-preselected-plan",
      identityKey,
      customerId,
      requestedPlanId,
    ] as const,
    queryFn: async () => {
      if (apiClient === null || customerId === null || requestedPlanId === null) {
        throw new Error("Receivable-plan selection is unavailable.");
      }
      const plan = await apiClient.getReceivablePlan(requestedPlanId);
      if (plan.customerId !== customerId || plan.contractId === null) {
        throw new Error("Requested receivable plan does not match the current customer.");
      }
      const availablePlans = await apiClient.getAvailableReceivablePlans(plan.contractId);
      const availablePlan = availablePlans.find((candidate) => candidate.id === plan.id);
      if (
        availablePlan === undefined ||
        availablePlan.customerId !== customerId ||
        availablePlan.contractId !== plan.contractId
      ) {
        throw new Error("Requested receivable plan is not available for the current contract.");
      }
      return {
        contract: {
          customerId: availablePlan.customerId,
          id: availablePlan.contractId,
          name: null,
          number: null,
          status: null,
        },
        plan: availablePlan,
      };
    },
    enabled:
      apiClient !== null &&
      customerId !== null &&
      requestedPlanId !== null &&
      canReadContracts &&
      canReadReceivablePlans,
  });
  const effectiveContract =
    hasManualRelationSelection || requestedPlanQuery.data === undefined
      ? selectedContract
      : requestedPlanQuery.data.contract;
  const effectivePlan =
    hasManualRelationSelection || requestedPlanQuery.data === undefined
      ? selectedPlan
      : requestedPlanQuery.data.plan;
  const availablePlansQuery = useQuery({
    queryKey: [
      "receivable-create-plan-selector",
      identityKey,
      customerId,
      effectiveContract?.id,
    ] as const,
    queryFn: () =>
      apiClient === null || customerId === null || effectiveContract === null
        ? Promise.reject(new Error("Receivable-plan selection is unavailable."))
        : apiClient.getAvailableReceivablePlans(effectiveContract.id).then((plans) => {
            if (
              plans.some(
                (plan) =>
                  plan.contractId !== effectiveContract.id || plan.customerId !== customerId,
              )
            ) {
              throw new Error("Receivable-plan selection does not match the current contract.");
            }
            return plans;
          }),
    enabled:
      apiClient !== null &&
      customerId !== null &&
      effectiveContract !== null &&
      canReadReceivablePlans &&
      planPickerOpen,
  });
  const memberQuery = useQuery({
    queryKey: ["member-selector", "receivable-create-owner", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Receivable owner selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: memberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && canSelectOwner,
  });
  const customFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "RECEIVABLE", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回款自定义字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("RECEIVABLE"),
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
      "receivable-custom-field-member-selector",
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
    enabled: apiClient !== null && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["receivable-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回款自定义部门字段的部门目录暂时不可用。"))
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
  const [fileFieldDraft, setFileFieldDraft] = useState<ReceivableCreateFileDraftState | null>(null);
  const [fileFieldErrors, setFileFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const createMutation = useMutation({
    mutationFn: ({
      amount,
      customFields,
      fileFieldSubmission,
      ownerActorId,
      paymentMethod,
      receivablePlanId,
      receivedDate,
      remark,
    }: ReceivableCreateSubmitValues) =>
      apiClient === null || effectiveContract === null
        ? Promise.reject(new Error("Receivable creation is unavailable."))
        : apiClient
            .createReceivable(
              toReceivableCreateRequest({
                amount,
                contractId: effectiveContract.id,
                customFields,
                fileFieldSubmission,
                ownerActorId,
                paymentMethod,
                receivablePlanId,
                receivedDate,
                remark,
              }),
            )
            .then((receivable) => {
              if (receivable.customerId !== customerId) {
                throw new Error(
                  "Receivable creation response does not match the current customer.",
                );
              }
              return receivable;
            }),
    onSuccess: (receivable) => {
      if (canReadReceivables) {
        void queryClient.invalidateQueries({ queryKey: receivableKeys.lists(identityKey) });
        if (canReadReceivablePlans) {
          void queryClient.invalidateQueries({ queryKey: receivablePlanKeys.lists(identityKey) });
        }
        const detailSearch = createSearch === "" ? "" : `?${createSearch}`;
        navigate(
          `/crm/customers/${receivable.customerId}/receivables/${receivable.id}${detailSearch}`,
          {
            replace: true,
          },
        );
      } else {
        setCreatedReceivableId(receivable.id);
      }
    },
  });
  const fileFieldUploadMutation = useMutation({
    mutationFn: async ({ fieldCode, files }: { fieldCode: string; files: readonly File[] }) => {
      if (apiClient === null) throw new Error("回款文件上传暂时不可用。");
      const draft =
        fileFieldDraft?.draft ?? (await apiClient.createCrmFileFieldDraft("RECEIVABLE"));
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

  function submit(values: ReceivableCreateFormValues) {
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
    const paymentMethod = values.paymentMethod?.trim();
    const receivedDate = values.receivedDate;
    if (
      effectiveContract === null ||
      amount === undefined ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      paymentMethod === undefined ||
      paymentMethod === "" ||
      !isDate(receivedDate) ||
      (values.ownerActorId !== undefined &&
        (!Number.isSafeInteger(values.ownerActorId) || values.ownerActorId <= 0))
    ) {
      return;
    }
    createMutation.mutate({
      amount,
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
      ownerActorId: values.ownerActorId,
      paymentMethod,
      ...(effectivePlan === null ? {} : { receivablePlanId: effectivePlan.id }),
      receivedDate,
      remark: values.remark,
    });
  }

  function closeContractPicker() {
    setContractPickerOpen(false);
    setContractKeyword("");
  }

  function closePlanPicker() {
    setPlanPickerOpen(false);
  }

  if (customerId === null) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.receivablesWrite}>
      <RouteAuthority authority={authority.contractsRead}>
        <RouteAuthority authority={authority.customersRead}>
          <main className={styles.page}>
            <section>
              <Button icon={<ArrowLeftOutlined />} type="link" onClick={() => navigate(returnPath)}>
                {returnLabel}
              </Button>
              <Typography.Title level={2}>新建回款</Typography.Title>
              <Typography.Text type="secondary">
                填写当前客户中服务端可见合同的到账日、金额、收款方式和可选备注；字段目录定义的动态字段和附件会按服务端规则提交。
              </Typography.Text>
            </section>
            {createMutation.isError ? (
              <Alert
                title={
                  createMutation.error instanceof ApiError
                    ? createMutation.error.message
                    : "回款暂时无法创建"
                }
                showIcon
                type="error"
              />
            ) : null}
            {requestedPlanId !== null && requestedPlanQuery.isError ? (
              <Alert
                description="该计划未能通过当前客户、合同和可见性校验；你仍可手动选择本次回款的合同与计划。"
                title="指定回款计划暂时不可用"
                showIcon
                type="warning"
              />
            ) : null}
            {customFieldDefinitionsQuery.isError ? (
              <Alert
                description="基础字段仍可填写；如租户配置了必填动态字段，请在字段目录恢复后再提交。"
                title="回款自定义字段暂时无法加载"
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
                    : "回款文件暂时无法上传"
                }
                showIcon
                type="error"
              />
            ) : null}
            {createdReceivableId !== null ? (
              <Alert
                description="当前成员没有回款读取权限，无法自动打开详情；后续可见范围仍由服务端决定。"
                title={`回款已创建，编号 ${createdReceivableId}`}
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
            <Card title="基本信息">
              <Form layout="vertical" onFinish={submit}>
                <Form.Item label="关联客户">
                  <Typography.Text>客户 {customerId}</Typography.Text>
                </Form.Item>
                <Form.Item label="关联合同" required>
                  {effectiveContract === null ? (
                    <Typography.Text type="secondary">尚未选择合同</Typography.Text>
                  ) : (
                    <Typography.Text>{contractLabel(effectiveContract)}</Typography.Text>
                  )}
                  <div className={styles.contractPickerControls}>
                    <Button
                      disabled={createMutation.isPending}
                      htmlType="button"
                      onClick={() => setContractPickerOpen(true)}
                    >
                      选择合同
                    </Button>
                    {effectiveContract !== null ? (
                      <Button
                        disabled={createMutation.isPending}
                        htmlType="button"
                        onClick={() => {
                          setHasManualRelationSelection(true);
                          setSelectedContract(null);
                          setSelectedPlan(null);
                        }}
                      >
                        清除选择
                      </Button>
                    ) : null}
                  </div>
                </Form.Item>
                <Form.Item label="关联回款计划（可选）">
                  {effectivePlan === null ? (
                    <Typography.Text type="secondary">未关联回款计划</Typography.Text>
                  ) : (
                    <Typography.Text>{planLabel(effectivePlan)}</Typography.Text>
                  )}
                  <div className={styles.contractPickerControls}>
                    {canReadReceivablePlans ? (
                      <Button
                        disabled={createMutation.isPending || effectiveContract === null}
                        htmlType="button"
                        onClick={() => setPlanPickerOpen(true)}
                      >
                        选择回款计划
                      </Button>
                    ) : (
                      <Typography.Text type="secondary">
                        当前没有回款计划读取权限，只能新建未关联回款。
                      </Typography.Text>
                    )}
                    {effectivePlan !== null ? (
                      <Button
                        disabled={createMutation.isPending}
                        htmlType="button"
                        onClick={() => {
                          setHasManualRelationSelection(true);
                          setSelectedContract(effectiveContract);
                          setSelectedPlan(null);
                        }}
                      >
                        清除选择
                      </Button>
                    ) : null}
                  </div>
                </Form.Item>
                <Form.Item
                  label="到账日期"
                  name="receivedDate"
                  rules={[{ required: true, message: "请选择到账日期" }]}
                >
                  <Input aria-label="到账日期" disabled={createMutation.isPending} type="date" />
                </Form.Item>
                <Form.Item
                  label="回款金额"
                  name="amount"
                  rules={[{ required: true, message: "请输入回款金额" }]}
                >
                  <InputNumber
                    aria-label="回款金额"
                    controls={false}
                    disabled={createMutation.isPending}
                    inputMode="decimal"
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
                  label="收款方式"
                  name="paymentMethod"
                  rules={[
                    { required: true, whitespace: true, message: "请输入收款方式" },
                    { max: 50, message: "收款方式不能超过 50 个字符" },
                  ]}
                >
                  <Input
                    aria-label="收款方式"
                    disabled={createMutation.isPending}
                    maxLength={50}
                    placeholder="例如：TRANSFER"
                  />
                </Form.Item>
                <Form.Item
                  label="备注"
                  name="remark"
                  rules={[{ max: 2000, message: "备注不能超过 2000 个字符" }]}
                >
                  <Input.TextArea
                    aria-label="备注"
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    disabled={createMutation.isPending}
                    maxLength={2000}
                    placeholder="填写本次回款说明（可选）"
                  />
                </Form.Item>
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
                  bindingObjectName="回款"
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
                <Typography.Paragraph type="secondary">
                  服务端会重新校验合同是否有效、可选计划是否属于该合同、剩余可回款金额、备注、动态字段、附件写入权限及默认负责人范围；提交失败不会自动重试。
                </Typography.Paragraph>
                <Space>
                  <Button
                    disabled={createMutation.isPending}
                    htmlType="button"
                    onClick={() => navigate(returnPath)}
                  >
                    取消
                  </Button>
                  <Button
                    disabled={
                      effectiveContract === null ||
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
                    创建回款
                  </Button>
                </Space>
              </Form>
            </Card>
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
                          setHasManualRelationSelection(true);
                          setSelectedContract(toReceivableContractSelection(contract));
                          setSelectedPlan(null);
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
          <Modal
            footer={null}
            open={planPickerOpen}
            title="选择关联回款计划"
            onCancel={closePlanPicker}
          >
            <Typography.Paragraph type="secondary">
              仅显示所选合同中服务端当前可见且可用的回款计划；金额不会展示、计算或写入浏览器。
            </Typography.Paragraph>
            {availablePlansQuery.isError ? (
              <Alert title="可关联回款计划暂时无法加载" showIcon type="error" />
            ) : (
              <List
                dataSource={[...(availablePlansQuery.data ?? [])]}
                loading={availablePlansQuery.isLoading}
                locale={{ emptyText: "暂无可关联回款计划" }}
                renderItem={(plan) => (
                  <List.Item
                    actions={[
                      <Button
                        key="select"
                        onClick={() => {
                          setHasManualRelationSelection(true);
                          setSelectedContract(effectiveContract);
                          setSelectedPlan(plan);
                          closePlanPicker();
                        }}
                      >
                        选择
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      description={
                        [plan.dueDate === null ? null : `到期日：${plan.dueDate}`, plan.status]
                          .filter((value): value is string => value !== null)
                          .join(" · ") || undefined
                      }
                      title={planLabel(plan)}
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
