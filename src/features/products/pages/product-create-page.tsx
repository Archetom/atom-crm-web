import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  List,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
} from "antd";
import { useState } from "react";
import { useNavigate } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import type { ProductImageType } from "../model/product-image";
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

import {
  maximumProductListPrice,
  toProductCreateRequest,
  type ProductCreateValues,
} from "../model/product-form";
import {
  isProductAvailability,
  productAvailabilityOptions,
  type ProductAvailability,
} from "../model/product-availability";
import { productCategoryOptions } from "../model/product-category";
import { productCategoryKeys, productKeys } from "../model/query-keys";

import styles from "./product-create-page.module.css";

interface ProductCreateFormValues {
  availability?: ProductAvailability;
  categoryId?: number;
  name?: string;
  code?: string;
  description?: string;
  listPrice?: number;
  ownerActorId?: number;
  unit?: string;
}

interface ProductCreateFileDraftState {
  draft: components["schemas"]["FileFieldDraftResponse"];
  filesByField: CreateFileFieldFiles;
}

interface ProductImageDraftState {
  draft: components["schemas"]["ProductImageDraftResponse"];
  filesByImageType: Readonly<
    Partial<Record<ProductImageType, components["schemas"]["ProductImageUploadStatusResponse"][]>>
  >;
}

const productImageGroups: readonly { imageType: ProductImageType; label: string }[] = [
  { imageType: "PRIMARY", label: "产品主图" },
  { imageType: "DETAIL", label: "产品详情图" },
];

export function ProductCreatePage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const [createdProductId, setCreatedProductId] = useState<number | null>(null);
  const [memberKeyword, setMemberKeyword] = useState("");
  const canReadProducts = hasAuthority(authorization, authority.productsRead);
  const canSelectOwner =
    hasAuthority(authorization, authority.productsAssign) &&
    hasAuthority(authorization, authority.organizationRead);
  const canReadCustomFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canWriteFiles = hasAuthority(authorization, authority.filesWrite);
  const categoriesQuery = useQuery({
    queryKey: productCategoryKeys.tree(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Product categories are unavailable."))
        : apiClient.getProductCategories(),
    enabled: apiClient !== null && canReadProducts,
  });
  const memberQuery = useQuery({
    queryKey: ["member-selector", "product-create-owner", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Product owner selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: memberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && canSelectOwner,
  });
  const customFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "PRODUCT", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("产品字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("PRODUCT"),
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
      "product-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("产品自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: apiClient !== null && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["product-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("产品自定义部门字段的部门目录暂时不可用。"))
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
  const [fileFieldDraft, setFileFieldDraft] = useState<ProductCreateFileDraftState | null>(null);
  const [fileFieldErrors, setFileFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [productImageDraft, setProductImageDraft] = useState<ProductImageDraftState | null>(null);
  const [productImageError, setProductImageError] = useState<string | null>(null);
  const createMutation = useMutation({
    mutationFn: (values: ProductCreateValues) =>
      apiClient === null
        ? Promise.reject(new Error("Product creation is unavailable."))
        : apiClient.createProduct(toProductCreateRequest(values)),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists(identityKey) });
      queryClient.setQueryData(productKeys.detail(identityKey, product.id), product);
      if (canReadProducts) {
        navigate(`/crm/products/${product.id}`, { replace: true });
      } else {
        setCreatedProductId(product.id);
      }
    },
  });
  const fileFieldUploadMutation = useMutation({
    mutationFn: async ({ fieldCode, files }: { fieldCode: string; files: readonly File[] }) => {
      if (apiClient === null) throw new Error("产品文件上传暂时不可用。");
      const draft = fileFieldDraft?.draft ?? (await apiClient.createCrmFileFieldDraft("PRODUCT"));
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
  const productImageUploadMutation = useMutation({
    mutationFn: async ({
      imageType,
      files,
    }: {
      imageType: ProductImageType;
      files: readonly File[];
    }) => {
      if (apiClient === null) throw new Error("产品图片上传暂时不可用。");
      const draft = productImageDraft?.draft ?? (await apiClient.createProductImageDraft());
      const uploaded = await apiClient.uploadProductImageDraftFiles(draft, imageType, files);
      return { imageType, uploaded };
    },
    onSuccess: ({ imageType, uploaded }) => {
      setProductImageDraft((current) => {
        const existingFiles = current?.filesByImageType[imageType] ?? [];
        const knownIds = new Set(existingFiles.map((file) => file.fileId));
        return {
          draft: uploaded.draft,
          filesByImageType: {
            ...(current?.filesByImageType ?? {}),
            [imageType]: [
              ...existingFiles,
              ...uploaded.files.filter((file) => !knownIds.has(file.fileId)),
            ],
          },
        };
      });
      setProductImageError(null);
    },
  });
  const productImageStatusMutation = useMutation({
    mutationFn: async ({ imageType, fileId }: { imageType: ProductImageType; fileId: number }) => {
      if (apiClient === null || productImageDraft === null) {
        throw new Error("产品图片草稿暂时不可用。");
      }
      const status = await apiClient.getProductImageDraftUploadStatus(
        productImageDraft.draft.draftId,
        imageType,
        fileId,
      );
      return { imageType, status };
    },
    onSuccess: ({ imageType, status }) => {
      setProductImageDraft((current) => {
        if (current === null) return current;
        return {
          ...current,
          filesByImageType: {
            ...current.filesByImageType,
            [imageType]: (current.filesByImageType[imageType] ?? []).map((file) =>
              file.fileId === status.fileId ? status : file,
            ),
          },
        };
      });
    },
  });
  const productImageDraftWithdrawalMutation = useMutation({
    mutationFn: async () => {
      if (apiClient === null || productImageDraft === null) {
        throw new Error("产品图片草稿暂时不可用。");
      }
      await apiClient.withdrawProductImageDraft(
        productImageDraft.draft.draftId,
        productImageDraft.draft.version,
      );
    },
    onSuccess: () => {
      setProductImageDraft(null);
      setProductImageError(null);
    },
  });
  const productImageMutationError =
    productImageUploadMutation.error ?? productImageStatusMutation.error;

  function submit(values: ProductCreateFormValues) {
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
    const productImageFiles = Object.values(productImageDraft?.filesByImageType ?? {}).flat();
    if (productImageFiles.some((file) => file.status !== "UPLOADED")) {
      setProductImageError("图片仍在检查或检查未通过。请刷新状态，或清空后重新选择图片。");
      return;
    }
    const availability = isProductAvailability(values.availability) ? values.availability : null;
    if (
      values.name === undefined ||
      values.code === undefined ||
      values.listPrice === undefined ||
      availability === null ||
      !Number.isFinite(values.listPrice) ||
      values.listPrice < 0 ||
      values.listPrice > maximumProductListPrice ||
      (values.categoryId !== undefined &&
        (!Number.isSafeInteger(values.categoryId) || values.categoryId <= 0)) ||
      (values.ownerActorId !== undefined &&
        (!Number.isSafeInteger(values.ownerActorId) || values.ownerActorId <= 0))
    ) {
      return;
    }

    createMutation.mutate({
      availability,
      categoryId: values.categoryId,
      code: values.code,
      customFields: toCustomFieldFormValues(customFieldDefinitions, customFieldValues),
      description: values.description,
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
      productImageSubmission:
        productImageDraft === null
          ? undefined
          : {
              draftId: productImageDraft.draft.draftId,
              images: Object.fromEntries(
                Object.entries(productImageDraft.filesByImageType).map(([imageType, files]) => [
                  imageType,
                  files.filter((file) => file.status === "UPLOADED").map((file) => file.fileId),
                ]),
              ),
            },
      listPrice: values.listPrice,
      name: values.name,
      ownerActorId: values.ownerActorId,
      unit: values.unit,
    });
  }

  function cancelCreate() {
    if (productImageDraft === null) {
      navigate("/crm/products");
      return;
    }
    productImageDraftWithdrawalMutation.mutate(undefined, {
      onSuccess: () => navigate("/crm/products"),
    });
  }

  return (
    <RouteAuthority authority={authority.productsWrite}>
      <main className={styles.page}>
        <section>
          <Typography.Title level={2}>新建产品</Typography.Title>
          <Typography.Text type="secondary">
            填写基本信息和可选目录字段；服务端继续复核字段权限、分类可用性与产品编码规则。
          </Typography.Text>
        </section>
        {createMutation.isError ? (
          <Alert
            title={
              createMutation.error instanceof ApiError
                ? createMutation.error.message
                : "产品暂时无法创建"
            }
            showIcon
            type="error"
          />
        ) : null}
        {createdProductId !== null ? (
          <Alert
            description="当前成员没有产品读取权限，无法自动打开详情；是否可读取和后续展示范围仍由服务端决定。"
            title={`产品已创建，编号 ${createdProductId}`}
            showIcon
            type="success"
          />
        ) : null}
        {categoriesQuery.isError ? (
          <Alert
            action={
              <Button size="small" type="link" onClick={() => void categoriesQuery.refetch()}>
                重试加载分类
              </Button>
            }
            description="你仍可创建未分类产品；需要分类时请重试后再保存。"
            title="产品分类目录暂时无法加载"
            showIcon
            type="warning"
          />
        ) : null}
        {customFieldDefinitionsQuery.isError ? (
          <Alert
            description="基础字段仍可填写；如租户配置了必填动态字段，请在字段目录恢复后再提交。"
            title="产品自定义字段暂时无法加载"
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
                : "产品文件暂时无法上传"
            }
            showIcon
            type="error"
          />
        ) : null}
        {productImageUploadMutation.isError ||
        productImageStatusMutation.isError ||
        productImageError ? (
          <Alert
            title={
              productImageError ??
              (productImageMutationError instanceof ApiError
                ? productImageMutationError.message
                : "产品图片暂时无法上传或检查")
            }
            showIcon
            type="error"
          />
        ) : null}
        {productImageDraftWithdrawalMutation.isError ? (
          <Alert
            title={
              productImageDraftWithdrawalMutation.error instanceof ApiError
                ? productImageDraftWithdrawalMutation.error.message
                : "产品图片草稿暂时无法撤回"
            }
            showIcon
            type="error"
          />
        ) : null}
        <Card title="基本信息">
          <Form<ProductCreateFormValues>
            initialValues={{ availability: "AVAILABLE" }}
            layout="vertical"
            onFinish={submit}
          >
            <div className={styles.fieldGrid}>
              <Form.Item
                label="产品名称"
                name="name"
                rules={[
                  { required: true, whitespace: true, message: "请输入产品名称" },
                  { max: 200, message: "产品名称不能超过 200 个字符" },
                ]}
              >
                <Input aria-label="产品名称" maxLength={200} placeholder="例如：企业版套餐" />
              </Form.Item>
              <Form.Item
                label="产品编码"
                name="code"
                rules={[
                  { required: true, whitespace: true, message: "请输入产品编码" },
                  { max: 100, message: "产品编码不能超过 100 个字符" },
                ]}
              >
                <Input aria-label="产品编码" maxLength={100} placeholder="例如：PLAN-PRO" />
              </Form.Item>
              {canReadProducts && !categoriesQuery.isError ? (
                <Form.Item label="产品分类" name="categoryId">
                  <Select
                    allowClear
                    aria-label="产品分类"
                    loading={categoriesQuery.isLoading}
                    options={productCategoryOptions(categoriesQuery.data ?? [])}
                    placeholder="选择产品分类（可选）"
                    showSearch
                    optionFilterProp="label"
                  />
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
              <Form.Item
                label="产品单位"
                name="unit"
                rules={[{ max: 50, message: "产品单位不能超过 50 个字符" }]}
              >
                <Input aria-label="产品单位" maxLength={50} placeholder="例如：套、月、用户" />
              </Form.Item>
              <Form.Item
                label="目录价"
                name="listPrice"
                rules={[
                  { required: true, message: "请输入目录价" },
                  {
                    type: "number",
                    min: 0,
                    max: maximumProductListPrice,
                    message: "请输入可安全提交的非负目录价",
                  },
                ]}
              >
                <InputNumber
                  aria-label="目录价"
                  className={styles.amountInput}
                  controls={false}
                  inputMode="decimal"
                  max={maximumProductListPrice}
                  min={0}
                  precision={2}
                  placeholder="例如：99.90"
                />
              </Form.Item>
              <Form.Item
                label="上架状态"
                name="availability"
                rules={[{ required: true, message: "请选择上架状态" }]}
              >
                <Select<ProductAvailability>
                  aria-label="上架状态"
                  options={productAvailabilityOptions.map((option) => ({ ...option }))}
                />
              </Form.Item>
              <Form.Item
                className={styles.fullWidth}
                label="产品说明"
                name="description"
                rules={[{ max: 2000, message: "产品说明不能超过 2000 个字符" }]}
              >
                <Input.TextArea
                  aria-label="产品说明"
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  maxLength={2000}
                  placeholder="说明产品适用范围、交付内容或限制（可选）"
                />
              </Form.Item>
              {canWriteFiles ? (
                <div className={styles.fullWidth}>
                  <Typography.Title level={4}>产品图片</Typography.Title>
                  <Typography.Paragraph type="secondary">
                    主图和详情图会先保存在私有草稿中。只有检查完成且你创建产品后，服务端才会原子绑定这些图片。
                  </Typography.Paragraph>
                  {productImageGroups.map(({ imageType, label }) => {
                    const files = productImageDraft?.filesByImageType[imageType] ?? [];
                    return (
                      <Card
                        key={imageType}
                        size="small"
                        title={label}
                        extra={
                          <Upload
                            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                            beforeUpload={(file) => {
                              productImageUploadMutation.mutate({ imageType, files: [file] });
                              return Upload.LIST_IGNORE;
                            }}
                            disabled={
                              createMutation.isPending ||
                              productImageUploadMutation.isPending ||
                              productImageDraftWithdrawalMutation.isPending
                            }
                            multiple
                            showUploadList={false}
                          >
                            <Button
                              disabled={
                                createMutation.isPending ||
                                productImageUploadMutation.isPending ||
                                productImageDraftWithdrawalMutation.isPending
                              }
                            >
                              上传{label}
                            </Button>
                          </Upload>
                        }
                      >
                        {files.length === 0 ? (
                          <Typography.Text type="secondary">尚未选择{label}</Typography.Text>
                        ) : (
                          <List
                            dataSource={files}
                            renderItem={(file) => (
                              <List.Item
                                actions={[
                                  <Button
                                    key="refresh"
                                    loading={productImageStatusMutation.isPending}
                                    size="small"
                                    onClick={() =>
                                      productImageStatusMutation.mutate({
                                        fileId: file.fileId,
                                        imageType,
                                      })
                                    }
                                  >
                                    刷新状态
                                  </Button>,
                                ]}
                              >
                                <Space size="small">
                                  <Typography.Text>{file.displayName}</Typography.Text>
                                  <Tag
                                    color={file.status === "UPLOADED" ? "success" : "processing"}
                                  >
                                    {file.status === "UPLOADED"
                                      ? "检查完成"
                                      : file.status === "FAILED"
                                        ? "检查失败"
                                        : "检查中"}
                                  </Tag>
                                </Space>
                              </List.Item>
                            )}
                          />
                        )}
                      </Card>
                    );
                  })}
                  {productImageDraft !== null ? (
                    <Popconfirm
                      cancelText="保留"
                      okText="清空"
                      title="清空本次产品图片？"
                      description="会撤回尚未创建产品的私有图片草稿。"
                      onConfirm={() => productImageDraftWithdrawalMutation.mutate()}
                    >
                      <Button
                        danger
                        loading={productImageDraftWithdrawalMutation.isPending}
                        size="small"
                      >
                        清空本次产品图片
                      </Button>
                    </Popconfirm>
                  ) : null}
                </div>
              ) : null}
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
                  bindingObjectName="产品"
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
              目录价直接按你确认的数值提交，浏览器不会计算税率、折扣、汇率或派生金额。
            </Typography.Paragraph>
            {canSelectOwner && memberQuery.isError ? (
              <Alert
                title="负责人目录暂时无法加载；可留空后由服务端默认当前成员"
                showIcon
                type="warning"
              />
            ) : null}
            <Space>
              <Button
                disabled={productImageDraftWithdrawalMutation.isPending}
                onClick={cancelCreate}
              >
                取消
              </Button>
              <Button
                disabled={
                  fileFieldUploadMutation.isPending ||
                  productImageUploadMutation.isPending ||
                  productImageStatusMutation.isPending ||
                  productImageDraftWithdrawalMutation.isPending ||
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
                创建产品
              </Button>
            </Space>
          </Form>
        </Card>
      </main>
    </RouteAuthority>
  );
}
