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
import { useNavigate, useParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict } from "~/api/errors/mutation-conflict";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import type { CustomerOption } from "~/components/entity-selector/customer-option";
import {
  CustomFieldFormFields,
  createFieldMetadataQueryKeys,
  customFieldFormDefinitions,
  validateCustomFieldFormValues,
  type CustomFieldValues,
} from "~/components/dynamic-field";
import { MutationConflictNotice } from "~/components/feedback/mutation-conflict-notice";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";

import {
  hasOpportunityUpdateChanges,
  isCompleteOpportunityEditableBaseline,
  maximumOpportunityEstimatedAmount,
  opportunityUpdateValuesFromBaseline,
  toOpportunityCustomFieldUpdateRequest,
  type CompleteOpportunityEditableBaseline,
  type OpportunityUpdateValues,
} from "../model/opportunity-form";
import { opportunityEditableBaselineKey, opportunityKeys } from "../model/query-keys";

import styles from "./opportunity-edit-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

interface OpportunityEditFormValues extends OpportunityUpdateValues {
  customerId: number;
  pipelineCode: string;
  stageCode: string;
}

export function OpportunityEditPage() {
  const { opportunityId: opportunityIdParam } = useParams();
  const opportunityId = parseRouteId(opportunityIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const identityKey = authState?.identityKey ?? "pending";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<OpportunityEditFormValues>();
  const [formBaselineOverride, setFormBaselineOverride] =
    useState<CompleteOpportunityEditableBaseline | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [changedCustomFieldCodes, setChangedCustomFieldCodes] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [customFieldErrors, setCustomFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [customFieldMemberKeyword, setCustomFieldMemberKeyword] = useState("");
  const [reviewOpportunityId, setReviewOpportunityId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const canReadPipelines = hasAuthority(authorization, authority.opportunityPipelinesRead);
  const canReadCustomFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const baselineQuery = useQuery({
    queryKey:
      opportunityId === null
        ? opportunityEditableBaselineKey(identityKey, 0)
        : opportunityEditableBaselineKey(identityKey, opportunityId),
    queryFn: () =>
      opportunityId === null || apiClient === null
        ? Promise.reject(new Error("Opportunity editable baseline is unavailable."))
        : apiClient.getOpportunityEditableBaseline(opportunityId),
    enabled: apiClient !== null && opportunityId !== null,
  });
  const completeBaseline =
    baselineQuery.data !== undefined && isCompleteOpportunityEditableBaseline(baselineQuery.data)
      ? baselineQuery.data
      : null;
  const customFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "OPPORTUNITY", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("商机字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("OPPORTUNITY"),
    enabled: apiClient !== null && completeBaseline !== null && canReadCustomFieldMetadata,
  });
  const customFieldDefinitions = customFieldDefinitionsQuery.data ?? [];
  const customFormFieldDefinitions = customFieldFormDefinitions(customFieldDefinitions);
  const hasMemberCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "USER",
  );
  const hasDepartmentCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "DEPARTMENT",
  );
  const formBaseline =
    formBaselineOverride?.id === opportunityId ? formBaselineOverride : completeBaseline;
  const reviewRequired = reviewOpportunityId === opportunityId;
  const selectedCustomerId = Form.useWatch("customerId", form);
  const selectedPipelineCode = Form.useWatch("pipelineCode", form);
  const selectedStageCode = Form.useWatch("stageCode", form);
  const customerCandidateQuery = useQuery({
    queryKey: ["opportunity-edit-customer-selector", identityKey, customerKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("商机客户选择暂时不可用。"))
        : apiClient.getVisibleCustomers({
            keyword: customerKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: apiClient !== null && customerPickerOpen && canReadCustomers,
  });
  const pipelineQuery = useQuery({
    queryKey: ["opportunity-edit-pipeline-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("商机销售管线目录暂时不可用。"))
        : apiClient.getOpportunityPipelines({ page: 1, size: 100, status: "ACTIVE" }),
    enabled: apiClient !== null && completeBaseline !== null && canReadPipelines,
  });
  const selectedPipeline = pipelineQuery.data?.find(
    (pipeline) => pipeline.code === selectedPipelineCode,
  );
  const stageQuery = useQuery({
    queryKey:
      selectedPipeline === undefined
        ? (["opportunity-edit-stage-selector", identityKey, 0] as const)
        : (["opportunity-edit-stage-selector", identityKey, selectedPipeline.id] as const),
    queryFn: () =>
      apiClient === null || selectedPipeline === undefined
        ? Promise.reject(new Error("商机销售阶段目录暂时不可用。"))
        : apiClient.getOpportunityPipelineStages(selectedPipeline.id, {
            page: 1,
            size: 100,
            status: "ACTIVE",
          }),
    enabled: apiClient !== null && selectedPipeline !== undefined && canReadPipelines,
  });
  const customFieldMemberQuery = useQuery({
    queryKey: [
      "opportunity-edit-custom-field-member-selector",
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
    enabled:
      apiClient !== null &&
      completeBaseline !== null &&
      canReadOrganization &&
      hasMemberCustomField &&
      !reviewRequired,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["opportunity-edit-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("商机自定义部门字段的部门目录暂时不可用。"))
        : apiClient.getVisibleDepartments(),
    enabled:
      apiClient !== null &&
      completeBaseline !== null &&
      canReadOrganization &&
      hasDepartmentCustomField &&
      !reviewRequired,
  });
  const updateMutation = useMutation({
    mutationFn: (request: Parameters<NonNullable<typeof apiClient>["updateOpportunity"]>[1]) =>
      apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity update is unavailable."))
        : apiClient.updateOpportunity(opportunityId, request),
    onSuccess: (opportunity) => {
      queryClient.setQueryData(opportunityKeys.detail(identityKey, opportunity.id), opportunity);
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
      queryClient.invalidateQueries({
        queryKey: opportunityEditableBaselineKey(identityKey, opportunity.id),
      });
      navigate(`/crm/opportunities/${opportunity.id}`, { replace: true });
    },
  });

  if (opportunityId === null) return <StatusPage kind="not-found" />;

  if (baselineQuery.isLoading) {
    return (
      <div
        aria-label="正在加载商机编辑信息"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (baselineQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(baselineQuery.error)}
        onRetry={() => void baselineQuery.refetch()}
      />
    );
  }

  if (baselineQuery.data === undefined) return <StatusPage kind="unavailable" />;

  if (!isCompleteOpportunityEditableBaseline(baselineQuery.data)) {
    return (
      <RouteAuthority authority={authority.opportunitiesWrite}>
        <main className={styles.page}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/crm/opportunities/${opportunityId}`)}
          >
            返回商机详情
          </Button>
          <Alert
            description="当前字段权限不足以读取并写入完整替换所需的基础字段。为防止遮罩或缺失字段被意外清空，系统不会显示编辑表单。请联系管理员调整商机字段权限后重试。"
            title="暂不能安全编辑此商机"
            showIcon
            type="warning"
          />
        </main>
      </RouteAuthority>
    );
  }

  if (formBaseline === null) return <StatusPage kind="unavailable" />;

  function closeCustomerPicker() {
    setCustomerPickerOpen(false);
    setCustomerKeyword("");
  }

  function chooseCustomer(customer: CustomerOption) {
    form.setFieldValue("customerId", customer.id);
    setSelectedCustomer(customer);
    closeCustomerPicker();
  }

  async function resolveConflict(
    resolution: "dismiss" | "keep-draft-and-reload" | "discard-draft-and-reload",
  ) {
    if (resolution === "dismiss") {
      updateMutation.reset();
      return;
    }

    const result = await baselineQuery.refetch();
    updateMutation.reset();
    if (resolution === "keep-draft-and-reload") {
      setFormBaselineOverride(formBaseline);
      setReviewOpportunityId(opportunityId);
      setNotice("已读取服务器最新版本。为避免自动覆盖，当前草稿已锁定，需明确放弃后才可继续编辑。");
      return;
    }

    if (result.data !== undefined && isCompleteOpportunityEditableBaseline(result.data)) {
      setFormBaselineOverride(result.data);
      setFormRevision((current) => current + 1);
      form.setFieldsValue({
        ...opportunityUpdateValuesFromBaseline(result.data),
        customerId: result.data.customerId,
        pipelineCode: result.data.pipelineCode,
        stageCode: result.data.stageCode,
      });
      setChangedCustomFieldCodes(new Set());
      setCustomFieldErrors({});
      setCustomFieldValues({});
      setCustomFieldMemberKeyword("");
      setSelectedCustomer(null);
      setCustomerKeyword("");
      setReviewOpportunityId(null);
      setNotice("已放弃本地草稿并载入服务器最新版本。");
      return;
    }

    setFormBaselineOverride(null);
    setReviewOpportunityId(null);
    setNotice("服务器当前不再允许安全编辑此商机。请联系管理员调整商机字段权限后重试。");
  }

  function submit(values: OpportunityEditFormValues) {
    const baseline = formBaseline;
    if (baseline === null) return;
    const customerChanged = values.customerId !== baseline.customerId;
    const customerSelection =
      customerChanged && selectedCustomer?.id === values.customerId ? selectedCustomer : null;
    if (customerChanged && customerSelection === null) {
      setNotice("请从服务端当前可见的客户目录中重新选择关联客户。");
      return;
    }
    const pipelineChanged = values.pipelineCode !== baseline.pipelineCode;
    const stageChanged = values.stageCode !== baseline.stageCode;
    const relationshipChanged = pipelineChanged || stageChanged;
    const pipelineSelection = pipelineQuery.data?.find(
      (pipeline) => pipeline.code === values.pipelineCode,
    );
    const stageSelection = stageQuery.data?.find((stage) => stage.code === values.stageCode);
    if (relationshipChanged && (pipelineSelection === undefined || stageSelection === undefined)) {
      setNotice("变更销售管线或阶段时，请从当前服务端活动目录中选择完整的管线和阶段。");
      return;
    }
    const relationships = {
      ...(customerSelection === null ? {} : { customerId: customerSelection.id }),
      ...(pipelineSelection === undefined || stageSelection === undefined
        ? {}
        : {
            pipelineStage: {
              pipelineCode: pipelineSelection.code,
              stageCode: stageSelection.code,
            },
          }),
    };
    const customFieldIssues = validateCustomFieldFormValues(
      customFieldDefinitions,
      customFieldValues,
    ).filter((issue) => changedCustomFieldCodes.has(issue.code));
    setCustomFieldErrors(
      Object.fromEntries(customFieldIssues.map((issue) => [issue.code, issue.message])),
    );
    if (customFieldIssues.length > 0) return;
    const hasBaseFieldChanges = hasOpportunityUpdateChanges(values, baseline, relationships);
    const hasCustomFieldChanges = changedCustomFieldCodes.size > 0;
    if (reviewRequired || (!hasBaseFieldChanges && !hasCustomFieldChanges)) {
      if (!reviewRequired) setNotice("未检测到字段修改。");
      return;
    }
    setNotice(null);
    updateMutation.mutate(
      toOpportunityCustomFieldUpdateRequest(
        values,
        baseline,
        customFieldDefinitions,
        {
          changedCodes: changedCustomFieldCodes,
          customFields: customFieldValues,
        },
        relationships,
      ),
    );
  }

  const activePipelines = pipelineQuery.data ?? [];
  const pipelineOptions = [
    ...(activePipelines.some((pipeline) => pipeline.code === formBaseline.pipelineCode)
      ? []
      : [
          {
            label: `当前销售管线（${formBaseline.pipelineCode}，已不在活动目录中）`,
            value: formBaseline.pipelineCode,
          },
        ]),
    ...activePipelines.map((pipeline) => ({
      label: `${pipeline.name}（${pipeline.code}）`,
      value: pipeline.code,
    })),
  ];
  const activeStages = stageQuery.data ?? [];
  const stageOptions = [
    ...(selectedPipelineCode === formBaseline.pipelineCode &&
    !activeStages.some((stage) => stage.code === formBaseline.stageCode)
      ? [
          {
            label: `当前销售阶段（${formBaseline.stageCode}，已不在活动目录中）`,
            value: formBaseline.stageCode,
          },
        ]
      : []),
    ...activeStages.map((stage) => ({
      label: `${stage.name}（${stage.code}）`,
      value: stage.code,
    })),
  ];
  const relationshipChangePending =
    selectedPipelineCode !== undefined &&
    selectedStageCode !== undefined &&
    (selectedPipelineCode !== formBaseline.pipelineCode ||
      selectedStageCode !== formBaseline.stageCode);
  const conflict = getMutationConflict(updateMutation.error);
  return (
    <RouteAuthority authority={authority.opportunitiesWrite}>
      <main className={styles.page}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/crm/opportunities/${opportunityId}`)}
        >
          返回商机详情
        </Button>
        <section>
          <Typography.Title level={2}>编辑商机</Typography.Title>
          <Typography.Text type="secondary">
            仅使用服务端安全编辑基线构造完整替换请求，并始终携带加载时的 version。
          </Typography.Text>
        </section>
        <div aria-live="polite">
          {notice ? (
            <Alert title={notice} showIcon type={reviewRequired ? "warning" : "info"} />
          ) : null}
        </div>
        {updateMutation.isError && conflict === null ? (
          <Alert
            title={
              updateMutation.error instanceof ApiError
                ? updateMutation.error.message
                : "商机暂时无法更新"
            }
            showIcon
            type="error"
          />
        ) : null}
        {updateMutation.isError ? (
          <MutationConflictNotice
            error={updateMutation.error}
            onResolve={(resolution) => void resolveConflict(resolution)}
          />
        ) : null}
        <Card title="基础信息">
          <Form<OpportunityEditFormValues>
            form={form}
            key={`${formBaseline.id}:${formBaseline.version}:${formRevision}`}
            disabled={reviewRequired}
            initialValues={{
              ...opportunityUpdateValuesFromBaseline(formBaseline),
              customerId: formBaseline.customerId,
              pipelineCode: formBaseline.pipelineCode,
              stageCode: formBaseline.stageCode,
            }}
            layout="vertical"
            onFinish={submit}
          >
            <div className={styles.fieldGrid}>
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
              <Form.Item
                hidden
                name="customerId"
                rules={[{ required: true, message: "请选择关联客户" }]}
              >
                <Input type="hidden" />
              </Form.Item>
              <Form.Item label="关联客户" required>
                <Space wrap>
                  <Typography.Text>
                    {selectedCustomer !== null && selectedCustomer.id === selectedCustomerId
                      ? `${selectedCustomer.name}（客户 ${selectedCustomer.id}）`
                      : `当前客户 ${formBaseline.customerId}`}
                  </Typography.Text>
                  <Button
                    disabled={reviewRequired || updateMutation.isPending || !canReadCustomers}
                    htmlType="button"
                    onClick={() => setCustomerPickerOpen(true)}
                  >
                    更换客户
                  </Button>
                </Space>
              </Form.Item>
              <Form.Item
                label="销售管线"
                name="pipelineCode"
                rules={[{ required: true, message: "请选择销售管线" }]}
              >
                <Select
                  aria-label="销售管线"
                  disabled={
                    reviewRequired ||
                    updateMutation.isPending ||
                    !canReadPipelines ||
                    pipelineQuery.isLoading ||
                    pipelineQuery.isError
                  }
                  loading={pipelineQuery.isLoading}
                  options={pipelineOptions}
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
                    reviewRequired ||
                    updateMutation.isPending ||
                    selectedPipeline === undefined ||
                    stageQuery.isLoading ||
                    stageQuery.isError
                  }
                  loading={stageQuery.isLoading}
                  options={stageOptions}
                  placeholder="请选择活动销售阶段"
                />
              </Form.Item>
              <Form.Item label="预计成交日期" name="expectedCloseDate">
                <Input aria-label="预计成交日期" type="date" />
              </Form.Item>
              <Form.Item
                label="预计金额"
                name="estimatedAmount"
                rules={[
                  {
                    type: "number",
                    min: 0,
                    max: maximumOpportunityEstimatedAmount,
                    message: "请输入可安全提交的非负预计金额",
                  },
                ]}
              >
                <InputNumber
                  aria-label="预计金额"
                  className={styles.amountInput}
                  controls={false}
                  inputMode="decimal"
                  max={maximumOpportunityEstimatedAmount}
                  min={0}
                  precision={2}
                  placeholder="例如 9999.00"
                />
              </Form.Item>
              <Form.Item
                label="下次联系时间"
                name="nextContactTime"
                rules={[
                  {
                    pattern: /^$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
                    message: "请选择有效的下次联系时间",
                  },
                ]}
              >
                <Input aria-label="下次联系时间" type="datetime-local" />
              </Form.Item>
              <Form.Item className={styles.fullWidth} label="商机说明" name="description">
                <Input.TextArea
                  aria-label="商机说明"
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  maxLength={2000}
                  placeholder="请输入商机说明"
                />
              </Form.Item>
            </div>
            {pipelineQuery.isError ? (
              <Alert
                title="商机销售管线目录暂时无法加载；未修改的当前管线会安全保留。"
                showIcon
                type="warning"
              />
            ) : null}
            {relationshipChangePending && stageQuery.isError ? (
              <Alert
                title="销售阶段目录暂时无法加载；请恢复当前管线和阶段，或稍后重试。"
                showIcon
                type="warning"
              />
            ) : null}
            {canReadCustomFieldMetadata && customFieldDefinitionsQuery.isLoading ? (
              <Spin aria-label="正在加载商机自定义字段目录" size="small" />
            ) : null}
            {canReadCustomFieldMetadata && customFieldDefinitionsQuery.isError ? (
              <Alert title="商机自定义字段目录暂时无法加载" showIcon type="warning" />
            ) : null}
            {customFormFieldDefinitions.length > 0 ? (
              <>
                <Typography.Paragraph type="secondary">
                  自定义字段从空白开始，避免将详情中的脱敏或只读值写回；只有本次明确填写或清除的字段会提交，未操作字段仍由服务端保留。
                </Typography.Paragraph>
                {!canReadOrganization && (hasMemberCustomField || hasDepartmentCustomField) ? (
                  <Alert
                    title="当前无组织目录读取权限，人员和部门字段不能选择新候选项；服务端仍会校验明确清除操作。"
                    showIcon
                    type="info"
                  />
                ) : null}
                <CustomFieldFormFields
                  definitions={customFieldDefinitions}
                  departmentOptions={customFieldDepartmentQuery.data ?? []}
                  disabled={reviewRequired || updateMutation.isPending}
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
              </>
            ) : null}
            <Typography.Paragraph type="secondary">
              保存前，服务端会再次校验字段权限、客户、销售管线、销售阶段和 version。
              清空“下次联系时间”会以明确的 null
              提交；预计金额按确认的数值提交，不在浏览器计算税率、折扣或汇率。
            </Typography.Paragraph>
            <div className={styles.actions}>
              <Button onClick={() => navigate(`/crm/opportunities/${opportunityId}`)}>取消</Button>
              <Button
                disabled={
                  reviewRequired ||
                  (changedCustomFieldCodes.size > 0 && customFieldDefinitionsQuery.isError)
                }
                htmlType="submit"
                loading={updateMutation.isPending}
                type="primary"
              >
                保存修改
              </Button>
            </div>
          </Form>
        </Card>
      </main>
      <Modal
        destroyOnHidden
        footer={null}
        open={customerPickerOpen}
        title="更换关联客户"
        onCancel={closeCustomerPicker}
      >
        <Typography.Paragraph type="secondary">
          候选客户只来自当前成员服务端可见范围；保存时服务端仍会重新校验商机写入范围、客户可见性和
          version。
        </Typography.Paragraph>
        <Input.Search
          allowClear
          placeholder="搜索可见客户"
          value={customerKeyword}
          onChange={(event) => setCustomerKeyword(event.target.value)}
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
                  <Button
                    htmlType="button"
                    key={customer.id}
                    type="link"
                    onClick={() => chooseCustomer(customer)}
                  >
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
    </RouteAuthority>
  );
}
