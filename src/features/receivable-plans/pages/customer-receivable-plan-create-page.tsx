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
  Space,
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
import { StatusPage } from "~/components/feedback/status-page";
import { customerContextGlobalListPath } from "~/components/entity-selector/customer-context-create-route";
import { toContractListItem, type ContractListItem } from "~/features/contracts";

import {
  maximumReceivablePlanReminderDays,
  toReceivablePlanCreateRequest,
  type ReceivablePlanFileFieldSubmission,
} from "../model/receivable-plan-form";
import { receivablePlanKeys } from "../model/query-keys";

import styles from "./customer-receivable-plan-create-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

interface ReceivablePlanCreateFormValues {
  dueDate?: string;
  paymentMethod?: string;
  plannedAmount?: number;
  reminderDays?: number;
  remark?: string;
}

interface ReceivablePlanCreateSubmitValues {
  customFields?: CustomFieldValues;
  dueDate: string;
  fileFieldSubmission?: ReceivablePlanFileFieldSubmission;
  paymentMethod: string;
  plannedAmount: number;
  reminderDays?: number;
  remark?: string;
}

interface ReceivablePlanCreateFileDraftState {
  draft: components["schemas"]["FileFieldDraftResponse"];
  filesByField: CreateFileFieldFiles;
}

function contractLabel(contract: ContractListItem): string {
  const reference = [contract.number, contract.name].filter(
    (value): value is string => value !== null && value.trim().length > 0,
  );
  return reference.length === 0 ? `合同 ${contract.id}` : reference.join(" · ");
}

function isDate(value: string | undefined): value is string {
  return value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function CustomerReceivablePlanCreatePage() {
  const { customerId: customerIdParam } = useParams();
  const customerId = parseRouteId(customerIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const [contractPickerOpen, setContractPickerOpen] = useState(false);
  const [contractKeyword, setContractKeyword] = useState("");
  const [selectedContract, setSelectedContract] = useState<ContractListItem | null>(null);
  const [createdPlanId, setCreatedPlanId] = useState<number | null>(null);
  const canReadPlans = hasAuthority(authorization, authority.receivablePlansRead);
  const canReadContracts = hasAuthority(authorization, authority.contractsRead);
  const canReadCustomFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canWriteFiles = hasAuthority(authorization, authority.filesWrite);
  const globalReturnPath = customerContextGlobalListPath(
    "/crm/receivable-plans",
    searchParams.toString(),
  );
  const returnPath =
    customerId === null || !canReadPlans
      ? customerId === null
        ? "/crm/customers"
        : `/crm/customers/${customerId}`
      : (globalReturnPath ?? `/crm/customers/${customerId}/receivable-plans`);
  const returnLabel = globalReturnPath === null ? "返回客户回款计划" : "返回回款计划管理";
  const contractCandidatesQuery = useQuery({
    queryKey: [
      "receivable-plan-contract-selector",
      identityKey,
      customerId,
      contractKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Receivable-plan contract selection is unavailable."))
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
  const customFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "RECEIVABLE_PLAN", "fields:read")
      .definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回款计划自定义字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("RECEIVABLE_PLAN"),
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
      "receivable-plan-custom-field-member-selector",
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
    enabled: apiClient !== null && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["receivable-plan-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回款计划自定义部门字段的部门目录暂时不可用。"))
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
  const [fileFieldDraft, setFileFieldDraft] = useState<ReceivablePlanCreateFileDraftState | null>(
    null,
  );
  const [fileFieldErrors, setFileFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const createMutation = useMutation({
    mutationFn: ({
      customFields,
      dueDate,
      fileFieldSubmission,
      paymentMethod,
      plannedAmount,
      reminderDays,
      remark,
    }: ReceivablePlanCreateSubmitValues) =>
      apiClient === null || selectedContract === null
        ? Promise.reject(new Error("Receivable-plan creation is unavailable."))
        : apiClient
            .createReceivablePlan(
              toReceivablePlanCreateRequest({
                contractId: selectedContract.id,
                customFields,
                dueDate,
                fileFieldSubmission,
                paymentMethod,
                plannedAmount,
                reminderDays,
                remark,
              }),
            )
            .then((plan) => {
              if (customerId === null || plan.customerId !== customerId) {
                throw new Error(
                  "Receivable-plan creation response does not match the current customer.",
                );
              }
              return plan;
            }),
    onSuccess: (plan) => {
      if (canReadPlans) {
        void queryClient.invalidateQueries({ queryKey: receivablePlanKeys.lists(identityKey) });
        navigate(
          `/crm/customers/${customerId}/receivable-plans/${plan.id}?${searchParams.toString()}`,
          {
            replace: true,
          },
        );
      } else {
        setCreatedPlanId(plan.id);
      }
    },
  });
  const fileFieldUploadMutation = useMutation({
    mutationFn: async ({ fieldCode, files }: { fieldCode: string; files: readonly File[] }) => {
      if (apiClient === null) throw new Error("回款计划文件上传暂时不可用。");
      const draft =
        fileFieldDraft?.draft ?? (await apiClient.createCrmFileFieldDraft("RECEIVABLE_PLAN"));
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

  function submit(values: ReceivablePlanCreateFormValues) {
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
    const dueDate = values.dueDate;
    const paymentMethod = values.paymentMethod?.trim();
    const plannedAmount = values.plannedAmount;
    const reminderDays = values.reminderDays;
    if (
      selectedContract === null ||
      !isDate(dueDate) ||
      paymentMethod === undefined ||
      paymentMethod === "" ||
      plannedAmount === undefined ||
      !Number.isFinite(plannedAmount) ||
      plannedAmount <= 0 ||
      (reminderDays !== undefined &&
        (!Number.isSafeInteger(reminderDays) ||
          reminderDays < 0 ||
          reminderDays > maximumReceivablePlanReminderDays))
    ) {
      return;
    }
    createMutation.mutate({
      customFields: toCustomFieldFormValues(customFieldDefinitions, customFieldValues),
      dueDate,
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
      paymentMethod,
      plannedAmount,
      reminderDays,
      remark: values.remark,
    });
  }

  function closeContractPicker() {
    setContractPickerOpen(false);
    setContractKeyword("");
  }

  if (customerId === null) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.receivablePlansWrite}>
      <RouteAuthority authority={authority.contractsRead}>
        <RouteAuthority authority={authority.customersRead}>
          <main className={styles.page}>
            <section>
              <Button icon={<ArrowLeftOutlined />} type="link" onClick={() => navigate(returnPath)}>
                {returnLabel}
              </Button>
              <Typography.Title level={2}>新建回款计划</Typography.Title>
              <Typography.Text type="secondary">
                填写当前客户中服务端可见合同的到期日、计划金额、收款方式、提前提醒天数和可选备注；字段目录定义的动态字段和附件会按服务端规则提交。
              </Typography.Text>
            </section>
            {createMutation.isError ? (
              <Alert
                title={
                  createMutation.error instanceof ApiError
                    ? createMutation.error.message
                    : "回款计划暂时无法创建"
                }
                showIcon
                type="error"
              />
            ) : null}
            {customFieldDefinitionsQuery.isError ? (
              <Alert
                description="基础字段仍可填写；如租户配置了必填动态字段，请在字段目录恢复后再提交。"
                title="回款计划自定义字段暂时无法加载"
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
                    : "回款计划文件暂时无法上传"
                }
                showIcon
                type="error"
              />
            ) : null}
            {createdPlanId !== null ? (
              <Alert
                description="当前成员没有回款计划读取权限，无法自动打开详情；后续可见范围仍由服务端决定。"
                title={`回款计划已创建，编号 ${createdPlanId}`}
                showIcon
                type="success"
              />
            ) : null}
            <Card title="基本信息">
              <Form layout="vertical" onFinish={submit}>
                <Form.Item label="关联客户">
                  <Typography.Text>客户 {customerId}</Typography.Text>
                </Form.Item>
                <Form.Item label="关联合同" required>
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
                  label="到期日期"
                  name="dueDate"
                  rules={[{ required: true, message: "请选择到期日期" }]}
                >
                  <Input aria-label="到期日期" disabled={createMutation.isPending} type="date" />
                </Form.Item>
                <Form.Item
                  label="计划金额"
                  name="plannedAmount"
                  rules={[{ required: true, message: "请输入计划金额" }]}
                >
                  <InputNumber
                    aria-label="计划金额"
                    controls={false}
                    disabled={createMutation.isPending}
                    inputMode="decimal"
                    min={0.01}
                    precision={2}
                    step={0.01}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item
                  label="提前几天提醒（可选）"
                  name="reminderDays"
                  rules={[
                    {
                      type: "number",
                      min: 0,
                      max: maximumReceivablePlanReminderDays,
                      message: "请输入有效的非负整数提醒天数",
                    },
                  ]}
                >
                  <InputNumber
                    aria-label="提前几天提醒"
                    controls={false}
                    disabled={createMutation.isPending}
                    max={maximumReceivablePlanReminderDays}
                    min={0}
                    precision={0}
                    style={{ width: "100%" }}
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
                    placeholder="填写本期计划说明（可选）"
                  />
                </Form.Item>
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
                  bindingObjectName="回款计划"
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
                  服务端会重新校验合同是否有效、可计划金额、提醒、备注、动态字段、附件写入权限和默认负责人范围；提交失败不会自动重试。
                </Typography.Paragraph>
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
                    创建回款计划
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
