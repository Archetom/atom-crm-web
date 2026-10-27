import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { saveControlledDownload } from "~/api/client/controlled-download";
import type { ProductImageType } from "../model/product-image";
import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict } from "~/api/errors/mutation-conflict";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  MutationConflictNotice,
  type MutationConflictResolution,
} from "~/components/feedback/mutation-conflict-notice";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";
import { ApprovalStartAction } from "~/features/approvals";
import { ControlledFileFieldDownloadCard } from "~/components/controlled-file-field";
import {
  createFieldMetadataQueryKeys,
  serverProvidedDynamicFields,
  ServerProvidedDynamicFieldDescriptions,
} from "~/components/dynamic-field";
import { formatServerAmount } from "~/shared/utils/format-server-amount";

import { formatProductAttachmentSize, toProductAttachments } from "../model/product-attachment";
import { isProductAvailability, type ProductAvailability } from "../model/product-availability";
import { productKeys } from "../model/query-keys";

import styles from "./product-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

function displayValue(value: string | null): string {
  return value ?? "—";
}

function availabilityActionLabel(availability: ProductAvailability): string {
  return availability === "AVAILABLE" ? "下架产品" : "上架产品";
}

function nextAvailability(availability: ProductAvailability): ProductAvailability {
  return availability === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";
}

export function ProductDetailPage() {
  const { productId: productIdParam } = useParams();
  return <ProductDetailSurface productId={parseRouteId(productIdParam)} />;
}

export function ProductDetailSurface({
  productId,
  onClose,
}: Readonly<{
  productId: number | null;
  onClose?: () => void;
}>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  function closeDetail() {
    if (onClose !== undefined) {
      onClose();
      return;
    }
    navigate("/crm/products", { replace: true });
  }
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [targetAvailability, setTargetAvailability] = useState<ProductAvailability | null>(null);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerMemberKeyword, setOwnerMemberKeyword] = useState("");
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canReadFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadAttachments =
    hasAuthority(authorization, authority.productsRead) &&
    hasAuthority(authorization, authority.filesRead);
  const canWriteAttachments =
    hasAuthority(authorization, authority.productsWrite) &&
    hasAuthority(authorization, authority.filesWrite);
  const productQuery = useQuery({
    queryKey:
      productId === null
        ? productKeys.detail(identityKey, 0)
        : productKeys.detail(identityKey, productId),
    queryFn: () =>
      productId === null || apiClient === null
        ? Promise.reject(new Error("Product detail is unavailable."))
        : apiClient.getProduct(productId),
    enabled: apiClient !== null && productId !== null,
  });
  const fieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "PRODUCT", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("产品字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("PRODUCT"),
    enabled: apiClient !== null && productId !== null && canReadFieldMetadata,
  });
  const ownerMemberQuery = useQuery({
    queryKey: ["member-selector", "product-owner", identityKey, ownerMemberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Member selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: ownerMemberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && ownerPickerOpen && canReadOrganization,
  });
  const primaryImageQuery = useQuery({
    queryKey: productKeys.productImageGroup(identityKey, productId ?? 0, "PRIMARY"),
    queryFn: () =>
      apiClient === null || productId === null
        ? Promise.reject(new Error("产品附件暂时无法加载。"))
        : apiClient.getAttachments(
            { targetId: productId, targetType: "product" },
            { page: 1, productImageType: "PRIMARY", size: 50 },
          ),
    enabled: apiClient !== null && productId !== null && canReadAttachments,
  });
  const detailImageQuery = useQuery({
    queryKey: productKeys.productImageGroup(identityKey, productId ?? 0, "DETAIL"),
    queryFn: () =>
      apiClient === null || productId === null
        ? Promise.reject(new Error("产品附件暂时无法加载。"))
        : apiClient.getAttachments(
            { targetId: productId, targetType: "product" },
            { page: 1, productImageType: "DETAIL", size: 50 },
          ),
    enabled: apiClient !== null && productId !== null && canReadAttachments,
  });
  const availabilityMutation = useMutation({
    mutationFn: (
      request: Parameters<NonNullable<typeof apiClient>["updateProductAvailability"]>[1],
    ) =>
      apiClient === null || productId === null
        ? Promise.reject(new Error("Product availability update is unavailable."))
        : apiClient.updateProductAvailability(productId, request),
    onSuccess: (product) => {
      queryClient.setQueryData(productKeys.detail(identityKey, product.id), product);
      queryClient.invalidateQueries({ queryKey: productKeys.lists(identityKey) });
      setAvailabilityDialogOpen(false);
      setTargetAvailability(null);
    },
  });
  const ownerMutation = useMutation({
    mutationFn: ({ actorId, version }: { actorId: number; version: number }) =>
      apiClient === null || productId === null
        ? Promise.reject(new Error("Product owner update is unavailable."))
        : apiClient.updateProductOwner(productId, { ownerActorId: actorId, version }),
    onSuccess: (product) => {
      queryClient.setQueryData(productKeys.detail(identityKey, product.id), product);
      queryClient.invalidateQueries({ queryKey: productKeys.lists(identityKey) });
      setOwnerPickerOpen(false);
      setOwnerMemberKeyword("");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || productId === null
        ? Promise.reject(new Error("Product delete is unavailable."))
        : apiClient.deleteProduct(productId, version),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: productKeys.detail(identityKey, productId ?? 0) });
      queryClient.removeQueries({
        queryKey: productKeys.productImages(identityKey, productId ?? 0),
      });
      queryClient.invalidateQueries({ queryKey: productKeys.lists(identityKey) });
      closeDetail();
    },
  });
  const uploadAttachmentMutation = useMutation({
    mutationFn: ({ imageType, files }: { imageType: ProductImageType; files: readonly File[] }) =>
      apiClient === null || productId === null
        ? Promise.reject(new Error("产品附件暂时无法上传。"))
        : apiClient.uploadAttachments({ targetId: productId, targetType: "product" }, files, {
            productImageType: imageType,
          }),
    onSuccess: (results) => {
      const statuses = results.map((result) => result.status.status);
      if (statuses.includes("REJECTED")) {
        message.warning("附件已上传，但有文件未通过安全检查。请重新选择文件后重试。");
      } else if (
        statuses.some((status) => status === "ACCEPTED_FOR_INSPECTION" || status === "UPLOADING")
      ) {
        message.success("附件已上传，正在进行安全检查；通过后才会显示并可下载。");
      } else if (statuses.every((status) => status === "AVAILABLE")) {
        message.success("附件已上传并可下载。");
      } else {
        message.info("附件已提交，请稍后刷新附件列表查看状态。");
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: productKeys.productImages(identityKey, productId ?? 0),
      });
    },
  });
  const downloadAttachmentMutation = useMutation({
    mutationFn: (fileId: number) =>
      apiClient === null || productId === null
        ? Promise.reject(new Error("产品附件暂时无法下载。"))
        : apiClient.downloadAttachment({ fileId, targetId: productId, targetType: "product" }),
    onSuccess: (download) => saveControlledDownload(download),
  });
  const withdrawAttachmentMutation = useMutation({
    mutationFn: ({ fileId, version }: { fileId: number; version: number }) =>
      apiClient === null || productId === null
        ? Promise.reject(new Error("产品附件暂时无法撤回。"))
        : apiClient.withdrawAttachment(
            { fileId, targetId: productId, targetType: "product" },
            version,
          ),
    onSuccess: () => {
      message.success("附件已撤回");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: productKeys.productImages(identityKey, productId ?? 0),
      });
    },
  });

  if (productId === null) return <StatusPage kind="not-found" />;

  if (productQuery.isLoading) {
    return (
      <div
        aria-label="正在加载产品详情"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (productQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(productQuery.error)}
        onRetry={() => void productQuery.refetch()}
      />
    );
  }

  const product = productQuery.data;
  if (product === undefined) return <StatusPage kind="unavailable" />;

  const productDynamicFields = serverProvidedDynamicFields(
    fieldDefinitionsQuery.data ?? [],
    product.customFields,
  );
  const availability = isProductAvailability(product.availability) ? product.availability : null;
  const availabilityConflict = getMutationConflict(availabilityMutation.error);
  const ownerConflict = getMutationConflict(ownerMutation.error);
  const deleteConflict = getMutationConflict(deleteMutation.error);
  const productAttachments = toProductAttachments(primaryImageQuery.data?.objectList ?? []);
  const productDetailImages = toProductAttachments(detailImageQuery.data?.objectList ?? []);
  function openAvailabilityDialog() {
    if (availability === null) return;
    availabilityMutation.reset();
    setTargetAvailability(nextAvailability(availability));
    setAvailabilityDialogOpen(true);
  }

  function closeAvailabilityDialog() {
    if (availabilityMutation.isPending) return;
    availabilityMutation.reset();
    setAvailabilityDialogOpen(false);
    setTargetAvailability(null);
  }

  function closeOwnerPicker() {
    if (ownerMutation.isPending) return;
    ownerMutation.reset();
    setOwnerPickerOpen(false);
    setOwnerMemberKeyword("");
  }

  async function resolveAvailabilityConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      availabilityMutation.reset();
      return;
    }

    const result = await productQuery.refetch();
    availabilityMutation.reset();
    if (resolution === "discard-draft-and-reload" && result.data !== undefined) {
      setAvailabilityDialogOpen(false);
      setTargetAvailability(null);
    }
  }

  async function resolveOwnerConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      ownerMutation.reset();
      return;
    }

    const result = await productQuery.refetch();
    ownerMutation.reset();
    if (resolution === "discard-draft-and-reload" && result.data !== undefined) {
      setOwnerPickerOpen(false);
      setOwnerMemberKeyword("");
    }
  }

  async function resolveDeleteConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      deleteMutation.reset();
      return;
    }

    await productQuery.refetch();
    deleteMutation.reset();
  }

  return (
    <RouteAuthority authority={authority.productsRead}>
      <main className={styles.page}>
        <Button icon={<ArrowLeftOutlined />} onClick={closeDetail}>
          返回产品
        </Button>
        <section className={styles.header}>
          <div>
            <Typography.Title level={2}>{product.name}</Typography.Title>
            <Typography.Text type="secondary">
              基础字段只按服务端返回展示；附件和字段附件在独立受控区域按权限读取。
            </Typography.Text>
          </div>
          <div className={styles.headerMeta}>
            {product.availability ? <Tag color="blue">{product.availability}</Tag> : null}
            {product.status ? <Tag>{product.status}</Tag> : null}
          </div>
        </section>
        <ActionAuthority authority={authority.productsWrite}>
          <Space wrap>
            <Button type="primary" onClick={() => navigate(`/crm/products/${product.id}/edit`)}>
              编辑基础信息
            </Button>
            {availability === null ? null : (
              <Button loading={availabilityMutation.isPending} onClick={openAvailabilityDialog}>
                {availabilityActionLabel(availability)}
              </Button>
            )}
          </Space>
        </ActionAuthority>
        <ApprovalStartAction
          objectType="PRODUCT"
          subjectId={product.id}
          onStarted={() => {
            void queryClient.invalidateQueries({
              queryKey: productKeys.detail(identityKey, product.id),
            });
            void queryClient.invalidateQueries({ queryKey: productKeys.lists(identityKey) });
          }}
        />
        <ActionAuthority authority={authority.productsAssign}>
          <ActionAuthority authority={authority.organizationRead}>
            <Space wrap>
              <Button
                loading={ownerMutation.isPending}
                onClick={() => {
                  ownerMutation.reset();
                  setOwnerPickerOpen(true);
                }}
              >
                变更负责人
              </Button>
            </Space>
          </ActionAuthority>
        </ActionAuthority>
        <ActionAuthority authority={authority.productsDelete}>
          <Popconfirm
            cancelText="取消"
            description="删除后产品会进入服务端软删除状态、停止可用，并由服务端撤回其附件与文件字段绑定。服务端会再次确认当前 version。"
            okButtonProps={{ danger: true }}
            okText="确认删除"
            title={`删除产品“${product.name}”？`}
            onConfirm={() => {
              deleteMutation.reset();
              deleteMutation.mutate(product.version);
            }}
          >
            <Button danger disabled={deleteMutation.isPending} loading={deleteMutation.isPending}>
              删除产品
            </Button>
          </Popconfirm>
        </ActionAuthority>
        {availabilityMutation.isError && availabilityConflict === null ? (
          <Alert
            title={
              availabilityMutation.error instanceof ApiError
                ? availabilityMutation.error.message
                : "产品可用性暂时无法更新"
            }
            showIcon
            type="error"
          />
        ) : null}
        {availabilityMutation.isError ? (
          <MutationConflictNotice
            error={availabilityMutation.error}
            onResolve={(resolution) => void resolveAvailabilityConflict(resolution)}
          />
        ) : null}
        {deleteMutation.isError && deleteConflict === null ? (
          <Alert
            title={
              deleteMutation.error instanceof ApiError
                ? deleteMutation.error.message
                : "产品暂时无法删除"
            }
            showIcon
            type="error"
          />
        ) : null}
        {deleteMutation.isError ? (
          <MutationConflictNotice
            error={deleteMutation.error}
            onResolve={(resolution) => void resolveDeleteConflict(resolution)}
          />
        ) : null}
        <Card title="基本信息">
          <Descriptions column={{ sm: 1, xs: 1 }} size="small">
            <Descriptions.Item label="产品编码">{displayValue(product.code)}</Descriptions.Item>
            <Descriptions.Item label="产品分类">
              {displayValue(product.categoryName)}
            </Descriptions.Item>
            <Descriptions.Item label="单位">{displayValue(product.unit)}</Descriptions.Item>
            <Descriptions.Item label="目录价">
              {formatServerAmount(product.listPrice)}
            </Descriptions.Item>
            <Descriptions.Item label="产品说明">
              {displayValue(product.description)}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {displayValue(product.createdTime)}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {displayValue(product.updatedTime)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
        {canReadFieldMetadata && fieldDefinitionsQuery.isLoading ? (
          <Card title="自定义字段">
            <Spin aria-label="正在加载产品自定义字段目录" />
          </Card>
        ) : null}
        {canReadFieldMetadata && fieldDefinitionsQuery.isError ? (
          <Card title="自定义字段">
            <Alert title="产品自定义字段目录暂时无法加载" showIcon type="error" />
          </Card>
        ) : null}
        {productDynamicFields.length > 0 ? (
          <Card title="自定义字段">
            <Typography.Paragraph type="secondary">
              值仅按服务端当前返回展示；不会作为编辑或字段权限判断的依据。
            </Typography.Paragraph>
            <ServerProvidedDynamicFieldDescriptions
              columns={{ sm: 1, xs: 1 }}
              definitions={fieldDefinitionsQuery.data ?? []}
              values={product.customFields}
            />
          </Card>
        ) : null}
        {canReadAttachments || canWriteAttachments ? (
          <Card
            extra={
              <Space wrap>
                {canReadAttachments ? (
                  <Button
                    disabled={primaryImageQuery.isFetching || detailImageQuery.isFetching}
                    onClick={() => {
                      void primaryImageQuery.refetch();
                      void detailImageQuery.refetch();
                    }}
                  >
                    刷新
                  </Button>
                ) : null}
                {canWriteAttachments ? (
                  <Upload
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    beforeUpload={(file) => {
                      if (uploadAttachmentMutation.isPending) {
                        message.info("产品附件正在上传，请等待当前文件处理完成。");
                        return Upload.LIST_IGNORE;
                      }
                      uploadAttachmentMutation.mutate({ files: [file], imageType: "PRIMARY" });
                      return Upload.LIST_IGNORE;
                    }}
                    disabled={uploadAttachmentMutation.isPending}
                    showUploadList={false}
                  >
                    <Button loading={uploadAttachmentMutation.isPending} type="primary">
                      上传图片附件
                    </Button>
                  </Upload>
                ) : null}
              </Space>
            }
            title="产品主图"
          >
            <Typography.Paragraph type="secondary">
              图片由服务端按主图分组、权限和安全检查状态管理。仅支持
              PNG、JPG、JPEG；通过检查后才会显示并可下载。
            </Typography.Paragraph>
            {!canReadAttachments ? (
              <Alert
                title="当前身份没有附件读取权限，无法查看或下载已上传附件。"
                showIcon
                type="info"
              />
            ) : null}
            {primaryImageQuery.isError ? (
              <Alert
                title={
                  primaryImageQuery.error instanceof ApiError
                    ? primaryImageQuery.error.message
                    : "产品附件暂时无法加载"
                }
                showIcon
                type="error"
              />
            ) : null}
            {uploadAttachmentMutation.isError ? (
              <Alert
                title={
                  uploadAttachmentMutation.error instanceof ApiError
                    ? uploadAttachmentMutation.error.message
                    : "产品附件暂时无法上传"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
            {downloadAttachmentMutation.isError ? (
              <Alert
                title={
                  downloadAttachmentMutation.error instanceof ApiError
                    ? downloadAttachmentMutation.error.message
                    : "产品附件暂时无法下载"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
            {withdrawAttachmentMutation.isError ? (
              <Alert
                title={
                  withdrawAttachmentMutation.error instanceof ApiError
                    ? withdrawAttachmentMutation.error.message
                    : "产品附件暂时无法撤回"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
            {canReadAttachments ? (
              <List
                dataSource={productAttachments}
                loading={primaryImageQuery.isFetching}
                locale={{ emptyText: primaryImageQuery.isLoading ? "" : "暂无可下载产品主图" }}
                renderItem={(attachment) => {
                  const attachmentVersion = attachment.version;
                  const canWithdraw = canWriteAttachments && attachmentVersion !== null;

                  return (
                    <List.Item
                      actions={[
                        <Button
                          disabled={downloadAttachmentMutation.isPending}
                          key={`download-${attachment.fileId}`}
                          loading={
                            downloadAttachmentMutation.isPending &&
                            downloadAttachmentMutation.variables === attachment.fileId
                          }
                          type="link"
                          onClick={() => downloadAttachmentMutation.mutate(attachment.fileId)}
                        >
                          下载
                        </Button>,
                        ...(canWithdraw
                          ? [
                              <Popconfirm
                                cancelText="取消"
                                key={`withdraw-${attachment.fileId}`}
                                okButtonProps={{ danger: true }}
                                okText="撤回"
                                title="确认撤回此产品附件？"
                                onConfirm={() =>
                                  withdrawAttachmentMutation.mutate({
                                    fileId: attachment.fileId,
                                    version: attachmentVersion,
                                  })
                                }
                              >
                                <Button
                                  danger
                                  disabled={withdrawAttachmentMutation.isPending}
                                  loading={
                                    withdrawAttachmentMutation.isPending &&
                                    withdrawAttachmentMutation.variables?.fileId ===
                                      attachment.fileId
                                  }
                                  type="link"
                                >
                                  撤回
                                </Button>
                              </Popconfirm>,
                            ]
                          : []),
                      ]}
                    >
                      <List.Item.Meta
                        description={`${attachment.mediaType ?? "媒体类型未提供"} · ${formatProductAttachmentSize(attachment.actualBytes)}`}
                        title={attachment.displayName}
                      />
                    </List.Item>
                  );
                }}
                rowKey={(attachment) => attachment.fileId}
              />
            ) : null}
          </Card>
        ) : null}
        {canReadAttachments || canWriteAttachments ? (
          <Card
            extra={
              canWriteAttachments ? (
                <Upload
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  beforeUpload={(file) => {
                    if (uploadAttachmentMutation.isPending) {
                      message.info("产品图片正在上传，请等待当前文件处理完成。");
                      return Upload.LIST_IGNORE;
                    }
                    uploadAttachmentMutation.mutate({ files: [file], imageType: "DETAIL" });
                    return Upload.LIST_IGNORE;
                  }}
                  disabled={uploadAttachmentMutation.isPending}
                  showUploadList={false}
                >
                  <Button loading={uploadAttachmentMutation.isPending} type="primary">
                    上传详情图
                  </Button>
                </Upload>
              ) : null
            }
            title="产品详情图"
          >
            <Typography.Paragraph type="secondary">
              图片由服务端按详情图分组、权限和安全检查状态管理。仅支持 PNG、JPG、JPEG。
            </Typography.Paragraph>
            {!canReadAttachments ? (
              <Alert
                title="当前身份没有附件读取权限，无法查看或下载已上传详情图。"
                showIcon
                type="info"
              />
            ) : null}
            {detailImageQuery.isError ? (
              <Alert
                title={
                  detailImageQuery.error instanceof ApiError
                    ? detailImageQuery.error.message
                    : "产品详情图暂时无法加载"
                }
                showIcon
                type="error"
              />
            ) : null}
            {canReadAttachments ? (
              <List
                dataSource={productDetailImages}
                loading={detailImageQuery.isFetching}
                locale={{ emptyText: detailImageQuery.isLoading ? "" : "暂无可下载产品详情图" }}
                renderItem={(attachment) => {
                  const attachmentVersion = attachment.version;
                  const canWithdraw = canWriteAttachments && attachmentVersion !== null;
                  return (
                    <List.Item
                      actions={[
                        <Button
                          disabled={downloadAttachmentMutation.isPending}
                          key={`download-detail-${attachment.fileId}`}
                          loading={
                            downloadAttachmentMutation.isPending &&
                            downloadAttachmentMutation.variables === attachment.fileId
                          }
                          type="link"
                          onClick={() => downloadAttachmentMutation.mutate(attachment.fileId)}
                        >
                          下载
                        </Button>,
                        ...(canWithdraw
                          ? [
                              <Popconfirm
                                cancelText="取消"
                                key={`withdraw-detail-${attachment.fileId}`}
                                okButtonProps={{ danger: true }}
                                okText="撤回"
                                title="确认撤回此产品详情图？"
                                onConfirm={() =>
                                  withdrawAttachmentMutation.mutate({
                                    fileId: attachment.fileId,
                                    version: attachmentVersion,
                                  })
                                }
                              >
                                <Button
                                  danger
                                  disabled={withdrawAttachmentMutation.isPending}
                                  loading={
                                    withdrawAttachmentMutation.isPending &&
                                    withdrawAttachmentMutation.variables?.fileId ===
                                      attachment.fileId
                                  }
                                  type="link"
                                >
                                  撤回
                                </Button>
                              </Popconfirm>,
                            ]
                          : []),
                      ]}
                    >
                      <List.Item.Meta
                        description={`${attachment.mediaType ?? "媒体类型未提供"} · ${formatProductAttachmentSize(attachment.actualBytes)}`}
                        title={attachment.displayName}
                      />
                    </List.Item>
                  );
                }}
                rowKey={(attachment) => attachment.fileId}
              />
            ) : null}
          </Card>
        ) : null}
        <ControlledFileFieldDownloadCard
          canRead={canReadAttachments}
          fileFields={product.fileFields}
          targetId={product.id}
          targetType="product"
          title="产品字段附件"
        />
        <Space orientation="vertical" size="small">
          <Typography.Text type="secondary">
            目录价仅格式化服务端数值，不在浏览器计算或作为编辑基线保存。
          </Typography.Text>
        </Space>
      </main>
      <Modal
        destroyOnHidden
        footer={
          <Space>
            <Button disabled={availabilityMutation.isPending} onClick={closeAvailabilityDialog}>
              取消
            </Button>
            <Button
              disabled={targetAvailability === null}
              loading={availabilityMutation.isPending}
              type="primary"
              onClick={() => {
                if (targetAvailability === null) return;
                availabilityMutation.mutate({
                  availability: targetAvailability,
                  version: product.version,
                });
              }}
            >
              确认{targetAvailability === "AVAILABLE" ? "上架" : "下架"}
            </Button>
          </Space>
        }
        open={availabilityDialogOpen}
        title={targetAvailability === "AVAILABLE" ? "上架产品" : "下架产品"}
        onCancel={closeAvailabilityDialog}
      >
        <Typography.Paragraph type="secondary">
          此操作仅变更产品可用性，并携带当前服务端详情的 version。成功响应才会更新页面和产品列表。
        </Typography.Paragraph>
      </Modal>
      <Modal
        destroyOnHidden
        footer={null}
        open={ownerPickerOpen}
        title="变更负责人"
        onCancel={closeOwnerPicker}
      >
        <Typography.Paragraph type="secondary">
          仅显示服务端允许当前成员查看的在职成员；最终可分配范围、字段权限和并发仍由服务端校验。
        </Typography.Paragraph>
        <Input.Search
          allowClear
          defaultValue={ownerMemberKeyword}
          placeholder="按成员姓名搜索"
          style={{ marginTop: 12 }}
          onSearch={(keyword) => setOwnerMemberKeyword(keyword)}
        />
        {ownerMemberQuery.isError ? (
          <Alert title="成员列表暂时无法加载" showIcon type="error" />
        ) : (
          <List
            dataSource={[...(ownerMemberQuery.data ?? [])]}
            loading={ownerMemberQuery.isLoading}
            locale={{ emptyText: "未找到可选择成员" }}
            renderItem={(member) => (
              <List.Item
                actions={[
                  <Button
                    disabled={ownerMutation.isPending}
                    key={member.actorId}
                    loading={ownerMutation.isPending}
                    type="link"
                    onClick={() =>
                      ownerMutation.mutate({ actorId: member.actorId, version: product.version })
                    }
                  >
                    选择
                  </Button>,
                ]}
              >
                <List.Item.Meta description={`成员 ${member.actorId}`} title={member.displayName} />
              </List.Item>
            )}
          />
        )}
        {ownerMutation.isError && ownerConflict === null ? (
          <Alert
            title={
              ownerMutation.error instanceof ApiError
                ? ownerMutation.error.message
                : "产品负责人暂时无法更新"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
        {ownerMutation.isError ? (
          <MutationConflictNotice
            error={ownerMutation.error}
            onResolve={(resolution) => void resolveOwnerConflict(resolution)}
          />
        ) : null}
      </Modal>
    </RouteAuthority>
  );
}
