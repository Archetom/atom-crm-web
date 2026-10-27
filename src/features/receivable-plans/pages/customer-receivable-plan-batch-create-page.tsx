import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
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
import { useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { toPageResult } from "~/components/data-view/pagination";
import {
  CustomFieldFormFields,
  createFieldMetadataQueryKeys,
  customFileFieldDefinitions,
  customFieldFormDefinitions,
  toCustomFieldFormValues,
  unsupportedRequiredCustomFieldDefinitions,
  validateCustomFieldFormValues,
  type CustomFieldValues,
} from "~/components/dynamic-field";
import { StatusPage } from "~/components/feedback/status-page";
import { customerContextGlobalListPath } from "~/components/entity-selector/customer-context-create-route";
import { toContractListItem, type ContractListItem } from "~/features/contracts";

import {
  maximumReceivablePlanReminderDays,
  toReceivablePlanBatchCreateRequest,
  type ReceivablePlanBatchDraftValues,
} from "../model/receivable-plan-form";
import { receivablePlanKeys } from "../model/query-keys";

import styles from "./customer-receivable-plan-create-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

interface ReceivablePlanBatchDraftFormValues {
  dueDate?: string;
  paymentMethod?: string;
  plannedAmount?: number;
  reminderDays?: number;
  remark?: string;
}

interface ReceivablePlanBatchCreateFormValues {
  plans?: readonly ReceivablePlanBatchDraftFormValues[];
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

export function CustomerReceivablePlanBatchCreatePage() {
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
  const [createdPlanCount, setCreatedPlanCount] = useState<number | null>(null);
  const nextPlanRowId = useRef(1);
  const [planRowIds, setPlanRowIds] = useState<readonly number[]>([0]);
  const [customFieldValuesByRow, setCustomFieldValuesByRow] = useState<
    Readonly<Record<number, CustomFieldValues>>
  >({});
  const [customFieldErrorsByRow, setCustomFieldErrorsByRow] = useState<
    Readonly<Record<number, Readonly<Record<string, string>>>>
  >({});
  const [customFieldMemberKeyword, setCustomFieldMemberKeyword] = useState("");
  const canReadPlans = hasAuthority(authorization, authority.receivablePlansRead);
  const canReadContracts = hasAuthority(authorization, authority.contractsRead);
  const canReadCustomFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
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
      "receivable-plan-batch-contract-selector",
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
  const unsupportedRequiredCustomFields =
    unsupportedRequiredCustomFieldDefinitions(customFieldDefinitions);
  const unsupportedRequiredBatchFileFields = customFileFieldDefinitions(
    customFieldDefinitions,
  ).filter((field) => field.required);
  const hasMemberCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "USER",
  );
  const hasDepartmentCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "DEPARTMENT",
  );
  const customFieldMemberQuery = useQuery({
    queryKey: [
      "receivable-plan-batch-custom-field-member-selector",
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
    queryKey: ["receivable-plan-batch-custom-field-department-selector", identityKey] as const,
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
  const createMutation = useMutation({
    mutationFn: (plans: ReceivablePlanBatchDraftValues[]) =>
      apiClient === null || selectedContract === null
        ? Promise.reject(new Error("Receivable-plan batch creation is unavailable."))
        : apiClient
            .createReceivablePlansBatch(
              toReceivablePlanBatchCreateRequest(selectedContract.id, plans),
            )
            .then((createdPlans) => {
              if (
                createdPlans.length !== plans.length ||
                createdPlans.some((plan) => plan.customerId !== customerId)
              ) {
                throw new Error(
                  "Receivable-plan batch creation response does not match the current customer.",
                );
              }
              return createdPlans;
            }),
    onSuccess: (createdPlans) => {
      if (canReadPlans) {
        void queryClient.invalidateQueries({ queryKey: receivablePlanKeys.lists(identityKey) });
        navigate(returnPath, { replace: true });
      } else {
        setCreatedPlanCount(createdPlans.length);
      }
    },
  });

  function submit(values: ReceivablePlanBatchCreateFormValues) {
    const drafts = values.plans;
    if (
      selectedContract === null ||
      drafts === undefined ||
      drafts.length === 0 ||
      drafts.length > 100
    ) {
      return;
    }
    if (planRowIds.length !== drafts.length) return;
    const nextCustomFieldErrors: Record<number, Readonly<Record<string, string>>> = {};
    for (const rowId of planRowIds) {
      const issues = validateCustomFieldFormValues(
        customFieldDefinitions,
        customFieldValuesByRow[rowId] ?? {},
      );
      if (issues.length > 0) {
        nextCustomFieldErrors[rowId] = Object.fromEntries(
          issues.map((issue) => [issue.code, issue.message]),
        );
      }
    }
    setCustomFieldErrorsByRow(nextCustomFieldErrors);
    if (Object.keys(nextCustomFieldErrors).length > 0) return;
    const plans: ReceivablePlanBatchDraftValues[] = [];
    for (const [index, draft] of drafts.entries()) {
      const rowId = planRowIds[index];
      if (rowId === undefined) return;
      const dueDate = draft.dueDate;
      const paymentMethod = draft.paymentMethod?.trim();
      const plannedAmount = draft.plannedAmount;
      const reminderDays = draft.reminderDays;
      if (
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
      plans.push({
        customFields: toCustomFieldFormValues(
          customFieldDefinitions,
          customFieldValuesByRow[rowId] ?? {},
        ),
        dueDate,
        paymentMethod,
        plannedAmount,
        reminderDays,
        remark: draft.remark,
      });
    }
    createMutation.mutate(plans);
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
              <Typography.Title level={2}>批量新建回款计划</Typography.Title>
              <Typography.Text type="secondary">
                仅提交当前客户中服务端可见的合同，以及每条计划直接填写的到期日、计划金额、收款方式、可选提醒/备注和字段目录允许的标量动态字段；批量接口不接受负责人或文件草稿。
              </Typography.Text>
            </section>
            {createMutation.isError ? (
              <Alert
                title={
                  createMutation.error instanceof ApiError
                    ? createMutation.error.message
                    : "回款计划暂时无法批量创建"
                }
                showIcon
                type="error"
              />
            ) : null}
            {createdPlanCount !== null ? (
              <Alert
                description="当前成员没有回款计划读取权限，无法自动打开列表；后续可见范围仍由服务端决定。"
                title={`已批量创建 ${createdPlanCount} 条回款计划`}
                showIcon
                type="success"
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
                description={`字段目录将这些关系字段标为必填，但批量计划没有安全的所属对象选择流程：${unsupportedRequiredCustomFields.map((field) => field.displayName).join("、")}。为避免静默遗漏必填数据，暂不允许创建。`}
                title="存在尚未支持的必填自定义字段"
                showIcon
                type="error"
              />
            ) : null}
            {unsupportedRequiredBatchFileFields.length > 0 ? (
              <Alert
                description={`字段目录将这些文件字段标为必填，但批量创建契约不接受文件草稿或文件 ID：${unsupportedRequiredBatchFileFields.map((field) => field.displayName).join("、")}。请改用单条新建完成每条附件。`}
                title="批量创建不支持必填自定义文件字段"
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
            <Card title="批量计划">
              <Form initialValues={{ plans: [{}] }} layout="vertical" onFinish={submit}>
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
                      htmlType="button"
                      onClick={() => setContractPickerOpen(true)}
                    >
                      选择合同
                    </Button>
                    {selectedContract !== null ? (
                      <Button
                        disabled={createMutation.isPending}
                        htmlType="button"
                        onClick={() => setSelectedContract(null)}
                      >
                        清除选择
                      </Button>
                    ) : null}
                  </div>
                </Form.Item>
                <Form.List name="plans">
                  {(fields, { add, remove }) => (
                    <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
                      {fields.map((field, index) => {
                        const rowId = planRowIds[index];
                        if (rowId === undefined) return null;
                        return (
                          <Card
                            extra={
                              fields.length > 1 ? (
                                <Button
                                  aria-label={`删除第 ${index + 1} 条计划`}
                                  disabled={createMutation.isPending}
                                  htmlType="button"
                                  icon={<DeleteOutlined />}
                                  type="text"
                                  onClick={() => {
                                    remove(field.name);
                                    setPlanRowIds((current) =>
                                      current.filter((_, currentIndex) => currentIndex !== index),
                                    );
                                  }}
                                />
                              ) : null
                            }
                            key={field.key}
                            size="small"
                            title={`第 ${index + 1} 条计划`}
                          >
                            <Form.Item
                              label="到期日期"
                              name={[field.name, "dueDate"]}
                              rules={[{ required: true, message: "请选择到期日期" }]}
                            >
                              <Input
                                aria-label={`第 ${index + 1} 条到期日期`}
                                disabled={createMutation.isPending}
                                type="date"
                              />
                            </Form.Item>
                            <Form.Item
                              label="计划金额"
                              name={[field.name, "plannedAmount"]}
                              rules={[{ required: true, message: "请输入计划金额" }]}
                            >
                              <InputNumber
                                aria-label={`第 ${index + 1} 条计划金额`}
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
                              label="收款方式"
                              name={[field.name, "paymentMethod"]}
                              rules={[
                                { required: true, whitespace: true, message: "请输入收款方式" },
                                { max: 50, message: "收款方式不能超过 50 个字符" },
                              ]}
                            >
                              <Input
                                aria-label={`第 ${index + 1} 条收款方式`}
                                disabled={createMutation.isPending}
                                maxLength={50}
                                placeholder="例如：TRANSFER"
                              />
                            </Form.Item>
                            <Form.Item
                              label="提前几天提醒"
                              name={[field.name, "reminderDays"]}
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
                                aria-label={`第 ${index + 1} 条提前几天提醒`}
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
                              name={[field.name, "remark"]}
                              rules={[{ max: 2000, message: "备注不能超过 2000 个字符" }]}
                            >
                              <Input.TextArea
                                aria-label={`第 ${index + 1} 条备注`}
                                autoSize={{ minRows: 2, maxRows: 5 }}
                                disabled={createMutation.isPending}
                                maxLength={2000}
                                placeholder="填写本期计划说明（可选）"
                              />
                            </Form.Item>
                            <CustomFieldFormFields
                              definitions={customFieldDefinitions}
                              departmentOptions={customFieldDepartmentQuery.data ?? []}
                              disabled={createMutation.isPending}
                              errors={customFieldErrorsByRow[rowId] ?? {}}
                              memberOptions={customFieldMemberQuery.data ?? []}
                              memberOptionsLoading={customFieldMemberQuery.isLoading}
                              values={customFieldValuesByRow[rowId] ?? {}}
                              onChange={(nextValues) =>
                                setCustomFieldValuesByRow((current) => ({
                                  ...current,
                                  [rowId]: nextValues,
                                }))
                              }
                              onFieldChange={(code) => {
                                setCustomFieldErrorsByRow((current) => {
                                  const rowErrors = current[rowId];
                                  if (rowErrors?.[code] === undefined) return current;
                                  return {
                                    ...current,
                                    [rowId]: Object.fromEntries(
                                      Object.entries(rowErrors).filter(
                                        ([currentCode]) => currentCode !== code,
                                      ),
                                    ),
                                  };
                                });
                              }}
                              onMemberSearch={setCustomFieldMemberKeyword}
                            />
                          </Card>
                        );
                      })}
                      <Button
                        disabled={
                          createMutation.isPending ||
                          fields.length >= 100 ||
                          (canReadCustomFieldMetadata && customFieldDefinitionsQuery.isLoading)
                        }
                        htmlType="button"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          add({});
                          setPlanRowIds((current) => [...current, nextPlanRowId.current++]);
                        }}
                      >
                        添加计划行
                      </Button>
                    </Space>
                  )}
                </Form.List>
                <Typography.Paragraph type="secondary">
                  服务端会原子校验合同是否有效、全部计划的可用额度、提醒/备注及每一行动态字段写入权限和当前成员负责人；批量接口没有文件草稿绑定，浏览器不计算或分摊金额，提交失败不会自动重试。
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
                      selectedContract === null ||
                      (canReadCustomFieldMetadata &&
                        (customFieldDefinitionsQuery.isLoading ||
                          customFieldDefinitionsQuery.isError)) ||
                      unsupportedRequiredCustomFields.length > 0 ||
                      unsupportedRequiredBatchFileFields.length > 0 ||
                      unavailableRequiredCandidateFields.length > 0
                    }
                    htmlType="submit"
                    loading={createMutation.isPending}
                    type="primary"
                  >
                    批量创建回款计划
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
