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
import { toContactListItem } from "~/features/contacts";
import { toOpportunityListItem } from "~/features/opportunities";

import {
  toContractCreateRequest,
  type ContractCreateValues,
  type ContractProductCreateValues,
} from "../model/contract-form";
import { contractKeys } from "../model/query-keys";
import { toProductListItem } from "~/features/products";

import styles from "./customer-contract-create-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

interface ContractCreateFormValues {
  contractType?: string;
  discountRate?: number;
  endDate?: Dayjs;
  name?: string;
  number?: string;
  orderDate?: Dayjs;
  ownerActorId?: number;
  paymentType?: string;
  remark?: string;
  startDate?: Dayjs;
}

type ContractRelationKind = "contact" | "opportunity";

interface ContractRelationOption {
  id: number;
  name: string;
}

interface SelectedProduct extends ContractProductCreateValues {
  name: string;
  code: string | null;
  categoryName: string | null;
  unit: string | null;
}

interface ContractCreateFileDraftState {
  draft: components["schemas"]["FileFieldDraftResponse"];
  filesByField: CreateFileFieldFiles;
}

const maximumContractInputAmount = Number.MAX_SAFE_INTEGER;

function dateValue(value: Dayjs | undefined): string | undefined {
  return value?.format("YYYY-MM-DD");
}

export function CustomerContractCreatePage() {
  const { customerId: customerIdParam } = useParams();
  const customerId = parseRouteId(customerIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const identityKey = authState?.identityKey ?? "pending";
  const [createdContractId, setCreatedContractId] = useState<number | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productKeyword, setProductKeyword] = useState("");
  const [memberKeyword, setMemberKeyword] = useState("");
  const [relationPicker, setRelationPicker] = useState<ContractRelationKind | null>(null);
  const [relationKeyword, setRelationKeyword] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContractRelationOption | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<ContractRelationOption | null>(
    null,
  );
  const [selectedProducts, setSelectedProducts] = useState<readonly SelectedProduct[]>([]);
  const canReadContracts = hasAuthority(authorization, authority.contractsRead);
  const canReadContacts = hasAuthority(authorization, authority.contactsRead);
  const canReadOpportunities = hasAuthority(authorization, authority.opportunitiesRead);
  const canReadProducts = hasAuthority(authorization, authority.productsRead);
  const canReadCustomFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canWriteFiles = hasAuthority(authorization, authority.filesWrite);
  const canSelectOwner =
    hasAuthority(authorization, authority.contractsAssign) && canReadOrganization;
  const globalReturnPath = customerContextGlobalListPath("/crm/contracts", searchParams.toString());
  const contractListPath =
    customerId === null || !canReadContracts
      ? customerId === null
        ? "/crm/customers"
        : `/crm/customers/${customerId}`
      : (globalReturnPath ?? `/crm/customers/${customerId}/contracts`);
  const productCandidateQuery = useQuery({
    queryKey: ["contract-product-selector", identityKey, productKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Contract product selection is unavailable."))
        : apiClient.getProducts({
            page: 1,
            size: 50,
            keyword: productKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && productPickerOpen && canReadProducts,
  });
  const memberQuery = useQuery({
    queryKey: ["member-selector", "contract-create-owner", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Contract owner selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: memberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && canSelectOwner,
  });
  const customFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "CONTRACT", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("合同字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("CONTRACT"),
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
      "contract-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("合同自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: apiClient !== null && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["contract-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("合同自定义部门字段的部门目录暂时不可用。"))
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
  const [fileFieldDraft, setFileFieldDraft] = useState<ContractCreateFileDraftState | null>(null);
  const [fileFieldErrors, setFileFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const productCandidates = productCandidateQuery.data
    ? toPageResult(productCandidateQuery.data, toProductListItem).items
    : [];
  const relationCandidatesQuery = useQuery({
    queryKey: [
      "contract-create-relation-selector",
      identityKey,
      customerId,
      relationPicker,
      relationKeyword,
    ] as const,
    queryFn: () => {
      if (apiClient === null || customerId === null || relationPicker === null) {
        return Promise.reject(new Error("Contract relation selection is unavailable."));
      }
      const query = {
        customerId,
        keyword: relationKeyword.trim() || undefined,
        page: 1,
        size: 50,
      };
      if (relationPicker === "contact") {
        return apiClient
          .getContacts(query)
          .then((pager) =>
            toPageResult(pager, toContactListItem).items.flatMap((relation) =>
              relation.id > 0 && relation.customerId === customerId
                ? [{ id: relation.id, name: relation.name }]
                : [],
            ),
          );
      }
      return apiClient
        .getOpportunities(query)
        .then((pager) =>
          toPageResult(pager, toOpportunityListItem).items.flatMap((relation) =>
            relation.customerId === customerId ? [{ id: relation.id, name: relation.name }] : [],
          ),
        );
    },
    enabled:
      apiClient !== null &&
      customerId !== null &&
      relationPicker !== null &&
      (relationPicker === "contact" ? canReadContacts : canReadOpportunities),
  });
  const createMutation = useMutation({
    mutationFn: (values: ContractCreateValues) =>
      apiClient === null
        ? Promise.reject(new Error("Contract creation is unavailable."))
        : apiClient.createContract(toContractCreateRequest(values)),
    onSuccess: (contract) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
      if (canReadContracts && contract.customerId === customerId) {
        queryClient.setQueryData(contractKeys.detail(identityKey, contract.id), contract);
        navigate(`/crm/customers/${contract.customerId}/contracts/${contract.id}`, {
          replace: true,
        });
      } else {
        setCreatedContractId(contract.id);
      }
    },
  });
  const fileFieldUploadMutation = useMutation({
    mutationFn: async ({ fieldCode, files }: { fieldCode: string; files: readonly File[] }) => {
      if (apiClient === null) throw new Error("合同文件上传暂时不可用。");
      const draft = fileFieldDraft?.draft ?? (await apiClient.createCrmFileFieldDraft("CONTRACT"));
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

  function submit(values: ContractCreateFormValues) {
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
    const name = values.name?.trim();
    const number = values.number?.trim();
    const discountRate = values.discountRate ?? 0;
    if (
      customerId === null ||
      name === undefined ||
      name === "" ||
      number === undefined ||
      number === "" ||
      !Number.isFinite(discountRate) ||
      discountRate < 0 ||
      discountRate > 100 ||
      (values.ownerActorId !== undefined &&
        (!Number.isSafeInteger(values.ownerActorId) || values.ownerActorId <= 0)) ||
      selectedProducts.some(
        (product) =>
          !Number.isFinite(product.quantity) ||
          product.quantity <= 0 ||
          product.quantity > maximumContractInputAmount ||
          (product.unitPrice !== undefined &&
            (!Number.isFinite(product.unitPrice) ||
              product.unitPrice < 0 ||
              product.unitPrice > maximumContractInputAmount)),
      )
    ) {
      return;
    }
    createMutation.mutate({
      contactId: selectedContact?.id,
      contractType: values.contractType,
      customFields: toCustomFieldFormValues(customFieldDefinitions, customFieldValues),
      customerId,
      discountRate,
      endDate: dateValue(values.endDate),
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
      name,
      number,
      orderDate: dateValue(values.orderDate),
      opportunityId: selectedOpportunity?.id,
      ownerActorId: values.ownerActorId,
      paymentType: values.paymentType,
      products: selectedProducts.map(({ productId, quantity, unitPrice }) => ({
        productId,
        quantity,
        unitPrice,
      })),
      remark: values.remark,
      startDate: dateValue(values.startDate),
    });
  }

  function closeProductPicker() {
    setProductPickerOpen(false);
    setProductKeyword("");
  }

  function closeRelationPicker() {
    setRelationPicker(null);
    setRelationKeyword("");
  }

  function selectRelation(relation: ContractRelationOption) {
    if (relationPicker === "contact") {
      setSelectedContact(relation);
    } else if (relationPicker === "opportunity") {
      setSelectedOpportunity(relation);
    }
    closeRelationPicker();
  }

  function addProduct(product: (typeof productCandidates)[number]) {
    setSelectedProducts((current) => {
      if (current.some((item) => item.productId === product.id)) return current;
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          code: product.code,
          categoryName: product.categoryName,
          unit: product.unit,
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(productId: number, value: number | null) {
    if (
      value === null ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > maximumContractInputAmount
    ) {
      return;
    }
    setSelectedProducts((current) =>
      current.map((product) =>
        product.productId === productId ? { ...product, quantity: value } : product,
      ),
    );
  }

  function updateUnitPrice(productId: number, value: number | null) {
    if (
      value !== null &&
      (!Number.isFinite(value) || value < 0 || value > maximumContractInputAmount)
    ) {
      return;
    }
    setSelectedProducts((current) =>
      current.map((product) =>
        product.productId === productId
          ? { ...product, ...(value === null ? { unitPrice: undefined } : { unitPrice: value }) }
          : product,
      ),
    );
  }

  function removeProduct(productId: number) {
    setSelectedProducts((current) => current.filter((product) => product.productId !== productId));
  }

  if (customerId === null) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.contractsWrite}>
      <RouteAuthority authority={authority.customersRead}>
        <>
          <main className={styles.page}>
            <section>
              <Button
                icon={<ArrowLeftOutlined />}
                type="link"
                onClick={() => navigate(contractListPath)}
              >
                返回客户合同
              </Button>
              <Typography.Title level={2}>新建合同</Typography.Title>
              <Typography.Text type="secondary">
                填写当前客户的合同信息、产品数量和可选成交单价；金额与折后总额始终由服务端计算。
              </Typography.Text>
            </section>
            {createMutation.isError ? (
              <Alert
                title={
                  createMutation.error instanceof ApiError
                    ? createMutation.error.message
                    : "合同暂时无法创建"
                }
                showIcon
                type="error"
              />
            ) : null}
            {customFieldDefinitionsQuery.isError ? (
              <Alert
                description="基础字段仍可填写；如租户配置了必填动态字段，请在字段目录恢复后再提交。"
                title="合同自定义字段暂时无法加载"
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
                    : "合同文件暂时无法上传"
                }
                showIcon
                type="error"
              />
            ) : null}
            {createdContractId !== null ? (
              <Alert
                description="当前成员没有合同读取权限，无法自动打开详情；后续可见范围仍由服务端决定。"
                title={`合同已创建，编号 ${createdContractId}`}
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
              <Form<ContractCreateFormValues>
                initialValues={{ discountRate: 0 }}
                layout="vertical"
                onFinish={submit}
              >
                <div className={styles.fieldGrid}>
                  <Form.Item className={styles.fullWidth} label="关联客户">
                    <Typography.Text>客户 {customerId}</Typography.Text>
                  </Form.Item>
                  <Form.Item
                    label="合同名称"
                    name="name"
                    rules={[
                      { required: true, whitespace: true, message: "请输入合同名称" },
                      { max: 200, message: "合同名称不能超过 200 个字符" },
                    ]}
                  >
                    <Input
                      aria-label="合同名称"
                      disabled={createMutation.isPending}
                      maxLength={200}
                      placeholder="例如：年度服务合同"
                    />
                  </Form.Item>
                  <Form.Item
                    label="合同编号"
                    name="number"
                    rules={[
                      { required: true, whitespace: true, message: "请输入合同编号" },
                      { max: 100, message: "合同编号不能超过 100 个字符" },
                    ]}
                  >
                    <Input
                      aria-label="合同编号"
                      disabled={createMutation.isPending}
                      maxLength={100}
                      placeholder="例如：HT-20260809-0001"
                    />
                  </Form.Item>
                  {canReadContacts ? (
                    <Form.Item label="联系人（可选）">
                      <Space orientation="vertical" size={4}>
                        <Typography.Text type="secondary">
                          {selectedContact === null ? "未关联联系人" : selectedContact.name}
                        </Typography.Text>
                        <Space>
                          <Button
                            disabled={createMutation.isPending}
                            htmlType="button"
                            onClick={() => setRelationPicker("contact")}
                          >
                            选择联系人
                          </Button>
                          {selectedContact !== null ? (
                            <Button
                              disabled={createMutation.isPending}
                              htmlType="button"
                              onClick={() => setSelectedContact(null)}
                            >
                              清除选择
                            </Button>
                          ) : null}
                        </Space>
                      </Space>
                    </Form.Item>
                  ) : null}
                  {canReadOpportunities ? (
                    <Form.Item label="关联商机（可选）">
                      <Space orientation="vertical" size={4}>
                        <Typography.Text type="secondary">
                          {selectedOpportunity === null ? "未关联商机" : selectedOpportunity.name}
                        </Typography.Text>
                        <Space>
                          <Button
                            disabled={createMutation.isPending}
                            htmlType="button"
                            onClick={() => setRelationPicker("opportunity")}
                          >
                            选择商机
                          </Button>
                          {selectedOpportunity !== null ? (
                            <Button
                              disabled={createMutation.isPending}
                              htmlType="button"
                              onClick={() => setSelectedOpportunity(null)}
                            >
                              清除选择
                            </Button>
                          ) : null}
                        </Space>
                      </Space>
                    </Form.Item>
                  ) : null}
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
                  <Form.Item label="签约日期" name="orderDate">
                    <DatePicker
                      aria-label="签约日期"
                      disabled={createMutation.isPending}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="合同类型"
                    name="contractType"
                    rules={[{ max: 100, message: "合同类型不能超过 100 个字符" }]}
                  >
                    <Input
                      aria-label="合同类型"
                      disabled={createMutation.isPending}
                      maxLength={100}
                      placeholder="例如：年度服务"
                    />
                  </Form.Item>
                  <Form.Item label="合同开始日期" name="startDate">
                    <DatePicker
                      aria-label="合同开始日期"
                      disabled={createMutation.isPending}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Form.Item label="合同结束日期" name="endDate">
                    <DatePicker
                      aria-label="合同结束日期"
                      disabled={createMutation.isPending}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="付款方式"
                    name="paymentType"
                    rules={[{ max: 200, message: "付款方式不能超过 200 个字符" }]}
                  >
                    <Input
                      aria-label="付款方式"
                      disabled={createMutation.isPending}
                      maxLength={200}
                      placeholder="例如：月结"
                    />
                  </Form.Item>
                  <Form.Item
                    label="整单折扣（%）"
                    name="discountRate"
                    rules={[
                      { required: true, message: "请输入整单折扣" },
                      { type: "number", min: 0, max: 100, message: "整单折扣应在 0 到 100 之间" },
                    ]}
                  >
                    <InputNumber
                      aria-label="整单折扣"
                      controls={false}
                      disabled={createMutation.isPending}
                      inputMode="decimal"
                      max={100}
                      min={0}
                      precision={4}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Form.Item
                    className={styles.fullWidth}
                    label="备注"
                    name="remark"
                    rules={[{ max: 2000, message: "备注不能超过 2000 个字符" }]}
                  >
                    <Input.TextArea
                      aria-label="备注"
                      autoSize={{ minRows: 3, maxRows: 8 }}
                      disabled={createMutation.isPending}
                      maxLength={2000}
                      placeholder="说明合同约定或补充事项（可选）"
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
                      bindingObjectName="合同"
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
                  服务端会重新校验客户可见性、字段权限、日期关系、产品可用性、价格、折扣和编号唯一性；负责人和协作者仍在独立流程中处理。
                </Typography.Paragraph>
                <Space>
                  <Button
                    disabled={createMutation.isPending}
                    onClick={() => navigate(contractListPath)}
                  >
                    取消
                  </Button>
                  <Button
                    disabled={
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
                    创建合同
                  </Button>
                </Space>
              </Form>
            </Card>
            <Card title="合同产品">
              {canReadProducts ? (
                <>
                  <Typography.Paragraph type="secondary">
                    产品只能从服务端当前可见目录选择。每行可填写数量和成交单价；单价留空时由服务端采用目录价，浏览器不计算折扣、行金额或合同总额。
                  </Typography.Paragraph>
                  <Button
                    disabled={createMutation.isPending}
                    onClick={() => setProductPickerOpen(true)}
                  >
                    选择产品
                  </Button>
                  <List
                    dataSource={[...selectedProducts]}
                    locale={{ emptyText: "暂未选择产品；可按合同需要保持空集合" }}
                    renderItem={(product) => {
                      const details = [
                        product.code === null ? null : `编码 ${product.code}`,
                        product.categoryName,
                        product.unit === null ? null : `单位 ${product.unit}`,
                      ].filter((value): value is string => value !== null);
                      return (
                        <List.Item
                          actions={[
                            <Button
                              key="remove"
                              danger
                              disabled={createMutation.isPending}
                              type="link"
                              onClick={() => removeProduct(product.productId)}
                            >
                              移除
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            description={details.length === 0 ? undefined : details.join(" · ")}
                            title={product.name}
                          />
                          <InputNumber
                            aria-label={`${product.name} 数量`}
                            controls={false}
                            disabled={createMutation.isPending}
                            inputMode="decimal"
                            min={0.000001}
                            max={maximumContractInputAmount}
                            value={product.quantity}
                            onChange={(value) => updateQuantity(product.productId, value)}
                          />
                          <InputNumber
                            aria-label={`${product.name} 成交单价`}
                            controls={false}
                            disabled={createMutation.isPending}
                            inputMode="decimal"
                            max={maximumContractInputAmount}
                            min={0}
                            precision={2}
                            placeholder="按目录价"
                            value={product.unitPrice}
                            onChange={(value) => updateUnitPrice(product.productId, value)}
                          />
                        </List.Item>
                      );
                    }}
                  />
                </>
              ) : (
                <Typography.Text type="secondary">
                  缺少产品目录读取权限时仍可创建空产品集合；前端不会猜测或手输产品 ID。
                </Typography.Text>
              )}
            </Card>
          </main>
          <Modal
            footer={null}
            open={productPickerOpen}
            title="选择合同产品"
            onCancel={closeProductPicker}
          >
            <Typography.Paragraph type="secondary">
              仅显示服务端当前可见的产品目录；选择后默认数量为 1，可在创建表单中调整。
            </Typography.Paragraph>
            <Input.Search
              allowClear
              placeholder="按产品名称或编码搜索"
              value={productKeyword}
              onChange={(event) => setProductKeyword(event.target.value)}
              onSearch={(keyword) => setProductKeyword(keyword)}
            />
            {productCandidateQuery.isError ? (
              <Alert title="合同产品目录暂时无法加载" showIcon type="error" />
            ) : (
              <List
                dataSource={productCandidates}
                loading={productCandidateQuery.isLoading}
                locale={{ emptyText: "暂无可选择产品" }}
                renderItem={(product) => {
                  const selected = selectedProducts.some((item) => item.productId === product.id);
                  const details = [
                    product.code === null ? null : `编码 ${product.code}`,
                    product.categoryName,
                    product.unit === null ? null : `单位 ${product.unit}`,
                  ].filter((value): value is string => value !== null);
                  return (
                    <List.Item
                      actions={[
                        <Button
                          key="select"
                          disabled={selected}
                          type="link"
                          onClick={() => {
                            addProduct(product);
                            closeProductPicker();
                          }}
                        >
                          {selected ? "已选择" : "选择"}
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        description={details.length === 0 ? undefined : details.join(" · ")}
                        title={product.name}
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Modal>
          <Modal
            destroyOnHidden
            footer={null}
            open={relationPicker !== null}
            title={relationPicker === "contact" ? "选择联系人" : "选择商机"}
            onCancel={closeRelationPicker}
          >
            <Typography.Paragraph type="secondary">
              仅显示服务端允许查看且明确属于当前客户的候选项；不能手动输入关联 ID。
            </Typography.Paragraph>
            <Input.Search
              allowClear
              defaultValue={relationKeyword}
              key={relationPicker}
              placeholder={relationPicker === "contact" ? "按联系人姓名搜索" : "按商机名称搜索"}
              onSearch={setRelationKeyword}
            />
            {relationCandidatesQuery.isError ? (
              <Alert
                title={
                  relationPicker === "contact" ? "联系人列表暂时无法加载" : "商机列表暂时无法加载"
                }
                showIcon
                type="error"
              />
            ) : (
              <List
                dataSource={relationCandidatesQuery.data ?? []}
                loading={relationCandidatesQuery.isLoading}
                locale={{ emptyText: "未找到可选择项" }}
                renderItem={(relation) => (
                  <List.Item
                    actions={[
                      <Button
                        disabled={createMutation.isPending}
                        key={relation.id}
                        onClick={() => selectRelation(relation)}
                      >
                        选择
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      description={`${relationPicker === "contact" ? "联系人" : "商机"} ${relation.id}`}
                      title={relation.name}
                    />
                  </List.Item>
                )}
              />
            )}
          </Modal>
        </>
      </RouteAuthority>
    </RouteAuthority>
  );
}
