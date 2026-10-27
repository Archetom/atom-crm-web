import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Input, InputNumber, Select, Spin, Typography } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict } from "~/api/errors/mutation-conflict";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  CustomFieldFormFields,
  EditFileFieldControls,
  createFieldMetadataQueryKeys,
  customFileFieldDefinitions,
  customFieldFormDefinitions,
  validateCustomFieldFormValues,
  type EditableFileFieldFile,
  type EditableFileFieldStatus,
  type CustomFieldValues,
} from "~/components/dynamic-field";
import { MutationConflictNotice } from "~/components/feedback/mutation-conflict-notice";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";

import { productCategoryOptions } from "../model/product-category";
import {
  isCompleteProductEditableBaseline,
  maximumProductListPrice,
  productUpdateValuesFromBaseline,
  toProductCustomFieldUpdateValues,
  toProductUpdateRequest,
  type CompleteProductEditableBaseline,
  type ProductUpdateValues,
} from "../model/product-form";
import type { ProductDetail } from "../model/product-detail";
import { productCategoryKeys, productEditableBaselineKey, productKeys } from "../model/query-keys";

import styles from "./product-edit-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

type ProductEditableFile = EditableFileFieldFile & { version?: number };

function attachmentStatus(value: string | undefined): EditableFileFieldStatus | null {
  switch (value) {
    case "ACCEPTED_FOR_INSPECTION":
    case "AVAILABLE":
    case "INDETERMINATE":
    case "REJECTED":
    case "UPLOADING":
      return value;
    default:
      return null;
  }
}

function boundFiles(
  product: ProductDetail | undefined,
  fieldCode: string,
): readonly ProductEditableFile[] {
  return (
    product?.fileFields
      .find((field) => field.fieldCode === fieldCode)
      ?.attachments.map((attachment) => ({
        displayName: attachment.displayName,
        fileId: attachment.fileId,
        status: "BOUND" as const,
      })) ?? []
  );
}

export function ProductEditPage() {
  const { productId: productIdParam } = useParams();
  const productId = parseRouteId(productIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const identityKey = authState?.identityKey ?? "pending";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formBaselineOverride, setFormBaselineOverride] =
    useState<CompleteProductEditableBaseline | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const [reviewProductId, setReviewProductId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canReadCustomFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canEditFileFields =
    hasAuthority(authorization, authority.productsRead) &&
    canReadCustomFieldMetadata &&
    hasAuthority(authorization, authority.filesRead) &&
    hasAuthority(authorization, authority.filesWrite);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [changedCustomFieldCodes, setChangedCustomFieldCodes] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [customFieldErrors, setCustomFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [customFieldMemberKeyword, setCustomFieldMemberKeyword] = useState("");
  const [fileFieldChanges, setFileFieldChanges] = useState<
    Readonly<Record<string, readonly ProductEditableFile[]>>
  >({});
  const [fileFieldErrors, setFileFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [isCancelling, setIsCancelling] = useState(false);
  const baselineQuery = useQuery({
    queryKey:
      productId === null
        ? productEditableBaselineKey(identityKey, 0)
        : productEditableBaselineKey(identityKey, productId),
    queryFn: () =>
      productId === null || apiClient === null
        ? Promise.reject(new Error("Product editable baseline is unavailable."))
        : apiClient.getProductEditableBaseline(productId),
    enabled: apiClient !== null && productId !== null,
  });
  const completeBaseline =
    baselineQuery.data !== undefined && isCompleteProductEditableBaseline(baselineQuery.data)
      ? baselineQuery.data
      : null;
  const formBaseline =
    formBaselineOverride?.id === productId ? formBaselineOverride : completeBaseline;
  const categoryQuery = useQuery({
    queryKey: productCategoryKeys.tree(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Product categories are unavailable."))
        : apiClient.getProductCategories(),
    enabled: apiClient !== null && formBaseline !== null,
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
  const fileFieldDetailQuery = useQuery({
    queryKey:
      productId === null
        ? productKeys.detail(identityKey, 0)
        : productKeys.detail(identityKey, productId),
    queryFn: () =>
      productId === null || apiClient === null
        ? Promise.reject(new Error("Product file fields are unavailable."))
        : apiClient.getProduct(productId),
    enabled:
      apiClient !== null && productId !== null && canEditFileFields && customFileFields.length > 0,
  });
  const hasMemberCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "USER",
  );
  const hasDepartmentCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "DEPARTMENT",
  );
  const customFieldMemberQuery = useQuery({
    queryKey: [
      "product-edit-custom-field-member-selector",
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
    queryKey: ["product-edit-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("产品自定义部门字段的部门目录暂时不可用。"))
        : apiClient.getVisibleDepartments(),
    enabled: apiClient !== null && canReadOrganization && hasDepartmentCustomField,
  });
  const reviewRequired = reviewProductId === productId;
  const updateMutation = useMutation({
    mutationFn: (request: Parameters<NonNullable<typeof apiClient>["updateProduct"]>[1]) =>
      apiClient === null || productId === null
        ? Promise.reject(new Error("Product update is unavailable."))
        : apiClient.updateProduct(productId, request),
    onSuccess: (product) => {
      queryClient.setQueryData(productKeys.detail(identityKey, product.id), product);
      queryClient.invalidateQueries({ queryKey: productKeys.lists(identityKey) });
      queryClient.invalidateQueries({
        queryKey: productEditableBaselineKey(identityKey, product.id),
      });
      navigate(`/crm/products/${product.id}`, { replace: true });
    },
  });
  const fileFieldUploadMutation = useMutation({
    mutationFn: async ({ fieldCode, files }: { fieldCode: string; files: readonly File[] }) => {
      if (apiClient === null || productId === null) {
        throw new Error("产品字段文件暂时无法上传。");
      }
      const uploaded = await apiClient.uploadExistingCrmFileFieldFiles(
        { targetId: productId, targetType: "product" },
        fieldCode,
        files,
      );
      const candidates = uploaded.files.map((file) => {
        const status = attachmentStatus(file.status.status);
        const version = file.status.version;
        if (
          status === null ||
          typeof version !== "number" ||
          !Number.isSafeInteger(version) ||
          version < 0
        ) {
          throw new Error("产品字段文件检查状态暂时不可用，请刷新后重试。");
        }
        return {
          displayName: file.displayName,
          fileId: file.fileId,
          status,
          version,
        } satisfies ProductEditableFile;
      });
      return { candidates, fieldCode };
    },
    onSuccess: ({ candidates, fieldCode }) => {
      setFileFieldChanges((current) => ({
        ...current,
        [fieldCode]: [
          ...(current[fieldCode] ?? boundFiles(fileFieldDetailQuery.data, fieldCode)),
          ...candidates,
        ],
      }));
      setFileFieldErrors((current) => {
        if (current[fieldCode] === undefined) return current;
        return Object.fromEntries(
          Object.entries(current).filter(([currentCode]) => currentCode !== fieldCode),
        );
      });
    },
  });
  const fileFieldStatusMutation = useMutation({
    mutationFn: async ({ fieldCode, fileId }: { fieldCode: string; fileId: number }) => {
      if (apiClient === null || productId === null) {
        throw new Error("产品字段文件检查状态暂时不可用。");
      }
      const status = await apiClient.getAttachmentUploadStatus(
        { targetId: productId, targetType: "product" },
        fileId,
      );
      const nextStatus = attachmentStatus(status.status);
      const version = status.version;
      if (
        nextStatus === null ||
        typeof version !== "number" ||
        !Number.isSafeInteger(version) ||
        version < 0
      ) {
        throw new Error("产品字段文件检查状态暂时不可用，请稍后重试。");
      }
      return { fieldCode, fileId, status: nextStatus, version };
    },
    onSuccess: ({ fieldCode, fileId, status, version }) => {
      setFileFieldChanges((current) => {
        const files = current[fieldCode];
        if (files === undefined) return current;
        return {
          ...current,
          [fieldCode]: files.map((file) =>
            file.fileId === fileId ? { ...file, status, version } : file,
          ),
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
  const fileFieldWithdrawalMutation = useMutation({
    mutationFn: async ({ fieldCode, file }: { fieldCode: string; file: ProductEditableFile }) => {
      if (file.status === "BOUND") return { fieldCode, fileId: file.fileId };
      const version = file.version;
      if (
        apiClient === null ||
        productId === null ||
        typeof version !== "number" ||
        !Number.isSafeInteger(version) ||
        version < 0
      ) {
        throw new Error("产品字段文件暂时无法撤回，请刷新后重试。");
      }
      await apiClient.withdrawAttachment(
        { fileId: file.fileId, targetId: productId, targetType: "product" },
        version,
      );
      return { fieldCode, fileId: file.fileId };
    },
    onSuccess: ({ fieldCode, fileId }) => {
      setFileFieldChanges((current) => ({
        ...current,
        [fieldCode]: (
          current[fieldCode] ?? boundFiles(fileFieldDetailQuery.data, fieldCode)
        ).filter((file) => file.fileId !== fileId),
      }));
      setFileFieldErrors((current) => {
        if (current[fieldCode] === undefined) return current;
        return Object.fromEntries(
          Object.entries(current).filter(([currentCode]) => currentCode !== fieldCode),
        );
      });
    },
  });

  if (productId === null) return <StatusPage kind="not-found" />;

  if (baselineQuery.isLoading) {
    return (
      <div
        aria-label="正在加载产品编辑信息"
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

  if (!isCompleteProductEditableBaseline(baselineQuery.data)) {
    return (
      <RouteAuthority authority={authority.productsWrite}>
        <main className={styles.page}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/crm/products/${productId}`)}
          >
            返回产品详情
          </Button>
          <Alert
            description="当前字段权限不足以读取并写入完整替换所需的基础字段。为防止遮罩或缺失字段被意外清空，系统不会显示编辑表单。请联系管理员调整产品字段权限后重试。"
            title="暂不能安全编辑此产品"
            showIcon
            type="warning"
          />
        </main>
      </RouteAuthority>
    );
  }

  if (formBaseline === null) return <StatusPage kind="unavailable" />;

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
      setReviewProductId(productId);
      setNotice("已读取服务器最新版本。为避免自动覆盖，当前草稿已锁定，需明确放弃后才可继续编辑。");
      return;
    }

    if (result.data !== undefined && isCompleteProductEditableBaseline(result.data)) {
      setFormBaselineOverride(result.data);
      setFormRevision((current) => current + 1);
      setChangedCustomFieldCodes(new Set());
      setCustomFieldErrors({});
      setCustomFieldValues({});
      setFileFieldChanges({});
      setFileFieldErrors({});
      if (canEditFileFields) await fileFieldDetailQuery.refetch();
      setReviewProductId(null);
      setNotice("已放弃本地草稿并载入服务器最新版本。");
      return;
    }

    setFormBaselineOverride(null);
    setReviewProductId(null);
    setNotice("服务器当前不再允许安全编辑此产品。请联系管理员调整产品字段权限后重试。");
  }

  function submit(values: ProductUpdateValues) {
    const baseline = formBaseline;
    if (
      reviewRequired ||
      baseline === null ||
      !Number.isFinite(values.listPrice) ||
      fileFieldUploadMutation.isPending ||
      fileFieldWithdrawalMutation.isPending
    ) {
      return;
    }
    const customFieldIssues = validateCustomFieldFormValues(
      customFieldDefinitions,
      customFieldValues,
    ).filter((issue) => changedCustomFieldCodes.has(issue.code));
    setCustomFieldErrors(
      Object.fromEntries(customFieldIssues.map((issue) => [issue.code, issue.message])),
    );
    const nextFileFieldErrors = Object.fromEntries(
      Object.entries(fileFieldChanges).flatMap(([fieldCode, files]) => {
        const pending = files.some(
          (file) =>
            file.status !== "BOUND" &&
            file.status !== "INDETERMINATE" &&
            file.status !== "AVAILABLE",
        );
        return pending
          ? [[fieldCode, "文件仍在上传、检查或未通过检查。请刷新检查状态或移除后再保存。"]]
          : [];
      }),
    );
    setFileFieldErrors(nextFileFieldErrors);
    if (customFieldIssues.length > 0 || Object.keys(nextFileFieldErrors).length > 0) return;
    setNotice(null);
    updateMutation.mutate(
      toProductUpdateRequest(
        {
          ...values,
          ...(changedCustomFieldCodes.size === 0
            ? {}
            : {
                customFields: toProductCustomFieldUpdateValues(
                  customFieldDefinitions,
                  customFieldValues,
                  changedCustomFieldCodes,
                ),
              }),
          ...(Object.keys(fileFieldChanges).length === 0
            ? {}
            : {
                fileFields: Object.fromEntries(
                  Object.entries(fileFieldChanges).map(([fieldCode, files]) => [
                    fieldCode,
                    files.map((file) => file.fileId),
                  ]),
                ),
              }),
        },
        baseline,
      ),
    );
  }

  async function cancelEditing() {
    const candidates = Object.entries(fileFieldChanges).flatMap(([fieldCode, files]) =>
      files.filter((file) => file.status !== "BOUND").map((file) => ({ fieldCode, file })),
    );
    if (candidates.length === 0 || apiClient === null || productId === null) {
      navigate(`/crm/products/${productId}`);
      return;
    }

    setIsCancelling(true);
    const results = await Promise.allSettled(
      candidates.map(({ file }) => {
        const version = file.version;
        if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
          return Promise.reject(new Error("产品字段文件版本不可用。"));
        }
        return apiClient.withdrawAttachment(
          { fileId: file.fileId, targetId: productId, targetType: "product" },
          version,
        );
      }),
    );
    const failedFields = candidates.flatMap(({ fieldCode }, index) =>
      results[index]?.status === "rejected" ? [fieldCode] : [],
    );
    if (failedFields.length > 0) {
      setFileFieldErrors(
        Object.fromEntries(
          [...new Set(failedFields)].map((fieldCode) => [
            fieldCode,
            "未能安全撤回未保存的文件。请重试移除后再离开编辑页。",
          ]),
        ),
      );
      setNotice("部分未保存的文件暂时无法撤回，仍停留在编辑页以避免遗留候选文件。");
      setIsCancelling(false);
      return;
    }
    navigate(`/crm/products/${productId}`);
  }

  const conflict = getMutationConflict(updateMutation.error);
  const fileFieldMutationError =
    fileFieldUploadMutation.error ??
    fileFieldStatusMutation.error ??
    fileFieldWithdrawalMutation.error;
  const options = productCategoryOptions(categoryQuery.data ?? []);
  const editableFilesByField = Object.fromEntries(
    customFileFields.map((field) => [
      field.code,
      fileFieldChanges[field.code] ?? boundFiles(fileFieldDetailQuery.data, field.code),
    ]),
  );
  return (
    <RouteAuthority authority={authority.productsWrite}>
      <main className={styles.page}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/crm/products/${productId}`)}>
          返回产品详情
        </Button>
        <section>
          <Typography.Title level={2}>编辑产品</Typography.Title>
          <Typography.Text type="secondary">
            仅使用服务端安全编辑基线构造完整替换请求，并始终携带加载时的 version。
          </Typography.Text>
        </section>
        {notice ? (
          <Alert title={notice} showIcon type={reviewRequired ? "warning" : "info"} />
        ) : null}
        {updateMutation.isError && conflict === null ? (
          <Alert
            title={
              updateMutation.error instanceof ApiError
                ? updateMutation.error.message
                : "产品暂时无法更新"
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
        {categoryQuery.isError ? (
          <Alert
            action={
              <Button size="small" type="link" onClick={() => void categoryQuery.refetch()}>
                重试
              </Button>
            }
            description="分类目录不可用时，系统不会构造完整替换请求，以避免分类字段被意外清空。"
            title="产品分类目录暂时无法加载"
            showIcon
            type="warning"
          />
        ) : null}
        {customFieldDefinitionsQuery.isError ? (
          <Alert
            description="基础字段仍可安全保存；字段目录恢复前，页面不会显示或提交任何自定义字段变更。"
            title="产品自定义字段暂时无法加载"
            showIcon
            type="warning"
          />
        ) : null}
        {customFileFields.length > 0 && !canEditFileFields ? (
          <Alert
            description="为避免把未授权、脱敏或不可下载的附件当作替换基线，当前身份需要产品读取、字段读取和文件读写权限后才能编辑自定义文件。"
            title="当前身份不能安全编辑产品自定义文件"
            showIcon
            type="warning"
          />
        ) : null}
        {fileFieldMutationError !== null ? (
          <Alert
            title={
              fileFieldMutationError instanceof ApiError
                ? fileFieldMutationError.message
                : "产品自定义文件暂时无法处理"
            }
            showIcon
            type="error"
          />
        ) : null}
        <Card title="基础信息">
          {categoryQuery.isLoading || categoryQuery.isError ? (
            <Spin aria-label="正在加载产品分类目录" />
          ) : (
            <Form<ProductUpdateValues>
              key={`${formBaseline.id}:${formBaseline.version}:${formRevision}`}
              disabled={reviewRequired || isCancelling}
              initialValues={productUpdateValuesFromBaseline(formBaseline)}
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
                  <Input aria-label="产品名称" maxLength={200} placeholder="请输入产品名称" />
                </Form.Item>
                <Form.Item
                  label="产品编码"
                  name="code"
                  rules={[
                    { required: true, whitespace: true, message: "请输入产品编码" },
                    { max: 100, message: "产品编码不能超过 100 个字符" },
                  ]}
                >
                  <Input aria-label="产品编码" maxLength={100} placeholder="请输入产品编码" />
                </Form.Item>
                <Form.Item label="产品分类" name="categoryId">
                  <Select
                    allowClear
                    aria-label="产品分类"
                    options={options}
                    placeholder="请选择产品分类"
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
                <Form.Item
                  label="单位"
                  name="unit"
                  rules={[{ max: 50, message: "单位不能超过 50 个字符" }]}
                >
                  <Input aria-label="单位" maxLength={50} placeholder="例如：套、月、用户" />
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
                    placeholder="例如 99.90"
                  />
                </Form.Item>
                <Form.Item className={styles.fullWidth} label="产品说明" name="description">
                  <Input.TextArea
                    aria-label="产品说明"
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    maxLength={2000}
                    placeholder="请输入产品说明"
                  />
                </Form.Item>
                {canReadCustomFieldMetadata && !customFieldDefinitionsQuery.isError ? (
                  <div className={styles.fullWidth}>
                    <CustomFieldFormFields
                      definitions={customFieldDefinitions}
                      departmentOptions={customFieldDepartmentQuery.data ?? []}
                      disabled={
                        reviewRequired ||
                        updateMutation.isPending ||
                        fileFieldUploadMutation.isPending ||
                        fileFieldWithdrawalMutation.isPending ||
                        isCancelling
                      }
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
                    {customFormFieldDefinitions.length > 0 ? (
                      <Typography.Paragraph type="secondary">
                        为避免将详情中的脱敏或只读值写回，所有自定义字段都从空白开始；仅你明确填写或清除的字段会随本次保存发送，未修改字段保持服务器当前值。
                      </Typography.Paragraph>
                    ) : null}
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
                    {customFileFields.length > 0 && canEditFileFields ? (
                      fileFieldDetailQuery.isLoading ? (
                        <Spin aria-label="正在加载产品自定义文件" />
                      ) : fileFieldDetailQuery.isError ? (
                        <Alert
                          action={
                            <Button
                              size="small"
                              type="link"
                              onClick={() => void fileFieldDetailQuery.refetch()}
                            >
                              重试
                            </Button>
                          }
                          description="文件详情不可用时，系统不会把空列表当作替换基线。基础字段仍可保存。"
                          title="产品自定义文件暂时无法加载"
                          showIcon
                          type="warning"
                        />
                      ) : (
                        <EditFileFieldControls
                          definitions={customFieldDefinitions}
                          disabled={
                            reviewRequired ||
                            updateMutation.isPending ||
                            fileFieldWithdrawalMutation.isPending ||
                            isCancelling
                          }
                          errors={fileFieldErrors}
                          filesByField={editableFilesByField}
                          refreshingFileId={
                            fileFieldStatusMutation.isPending
                              ? fileFieldStatusMutation.variables?.fileId
                              : undefined
                          }
                          uploading={fileFieldUploadMutation.isPending}
                          onRefresh={(fieldCode, fileId) =>
                            fileFieldStatusMutation.mutate({ fieldCode, fileId })
                          }
                          onRemove={(fieldCode, fileId) => {
                            const file = editableFilesByField[fieldCode]?.find(
                              (candidate) => candidate.fileId === fileId,
                            );
                            if (file !== undefined) {
                              fileFieldWithdrawalMutation.mutate({ fieldCode, file });
                            }
                          }}
                          onUpload={(fieldCode, files) =>
                            (editableFilesByField[fieldCode]?.length ?? 0) + files.length > 10
                              ? setFileFieldErrors((current) => ({
                                  ...current,
                                  [fieldCode]: "每个自定义文件字段最多保留 10 个文件。",
                                }))
                              : fileFieldUploadMutation.mutate({ fieldCode, files })
                          }
                        />
                      )
                    ) : null}
                  </div>
                ) : null}
              </div>
              <Typography.Paragraph type="secondary">
                保存前，服务端会再次校验字段权限、分类可用性和
                version；目录价直接按确认的数值提交，不在浏览器计算税率、折扣或汇率。
              </Typography.Paragraph>
              <div className={styles.actions}>
                <Button loading={isCancelling} onClick={() => void cancelEditing()}>
                  取消
                </Button>
                <Button
                  disabled={
                    fileFieldUploadMutation.isPending ||
                    fileFieldWithdrawalMutation.isPending ||
                    isCancelling
                  }
                  htmlType="submit"
                  loading={updateMutation.isPending}
                  type="primary"
                >
                  保存修改
                </Button>
              </div>
            </Form>
          )}
        </Card>
      </main>
    </RouteAuthority>
  );
}
