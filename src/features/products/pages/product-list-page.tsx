import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Modal, Select, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import { saveControlledDownload } from "~/api/client/controlled-download";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { useGlobalRecordListRelationFilter } from "~/components/data-view/global-record-list-relation-filter";
import {
  ColumnPreferenceControls,
  type ColumnPreferenceOption,
} from "~/components/data-view/column-preference-controls";
import {
  dynamicListColumnOptions,
  dynamicListColumns,
} from "~/components/data-view/dynamic-list-columns";
import { createFieldMetadataQueryKeys } from "~/components/dynamic-field";
import {
  defaultPageRequest,
  normalizePageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";
import { DataWorkspace } from "~/components/page/data-workspace";
import { FilterBar } from "~/components/page/filter-bar";
import { CrmCsvImportModal } from "~/features/crm-import-drafts";
import { PageHeader } from "~/components/page/page-header";
import { SavedViewControls } from "~/features/saved-views";
import { savedViewKeys } from "~/features/saved-views";
import { resolveSavedView, savedViewSelectionFromSearch } from "~/features/saved-views";

import { toProductListItem, type ProductListItem } from "../model/product-list-item";
import { selectedProductIdFromSearch } from "../model/product-list-route";
import { ProductDetailDrawer } from "../components/product-detail-drawer";
import {
  productListSceneFromSearch,
  withProductListScene,
  type ProductListScene,
} from "../model/product-list-scene";
import {
  defaultProductListSort,
  productCustomSortOptions,
  productListSortFromSearch,
  productListSortLabel,
  productListSortOptions,
  resolveProductListSort,
  withProductListSort,
  type ProductListSort,
} from "../model/product-list-sort";
import { productKeys } from "../model/query-keys";
import { productCategoryRelationFilter } from "../model/product-category-relation-filter";

import styles from "./product-list-page.module.css";

function updateSearch(
  current: URLSearchParams,
  update: Record<string, number | string | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}

function columns(onOpen: (product: ProductListItem) => void): ColumnsType<ProductListItem> {
  return [
    {
      dataIndex: "name",
      key: "product_name",
      title: "产品名称",
      render: (name: string, product) => (
        <Typography.Text strong>
          <Button data-detail-trigger-id={product.id} type="link" onClick={() => onOpen(product)}>
            {name}
          </Button>
        </Typography.Text>
      ),
    },
    {
      dataIndex: "code",
      key: "product_code",
      title: "产品编码",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "categoryName",
      key: "category",
      title: "分类",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "unit",
      key: "unit",
      title: "单位",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "availability",
      key: "availability",
      title: "可用性",
      render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
    },
    {
      fixed: "right",
      key: "actions",
      title: "操作",
      width: 88,
      render: (_, product) => (
        <Button data-detail-trigger-id={product.id} type="link" onClick={() => onOpen(product)}>
          查看
        </Button>
      ),
    },
  ];
}

const productColumnOptions: readonly ColumnPreferenceOption[] = [
  { code: "product_name", label: "产品名称" },
  { code: "product_code", label: "产品编码" },
  { code: "category", label: "分类" },
  { code: "unit", label: "单位" },
  { code: "availability", label: "可用性" },
];

const defaultProductExportFieldCodes = [
  "product_name",
  "product_code",
  "unit",
  "availability",
] as const;

export function ProductListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [temporaryConditions, setTemporaryConditions] = useState<
    components["schemas"]["FilterConditionRequest"][]
  >([]);
  const [visibleProductColumnCodes, setVisibleProductColumnCodes] = useState<readonly string[]>(
    () => productColumnOptions.map((option) => option.code),
  );
  const search = searchParams.toString();
  const selectedProductId = useMemo(() => selectedProductIdFromSearch(search), [search]);
  const scene = productListSceneFromSearch(search);
  const requestedSort = productListSortFromSearch(search);
  const request = useMemo(() => {
    const params = new URLSearchParams(search);
    const page = normalizePageRequest({
      page: Number.parseInt(params.get("page") ?? "", 10),
      size: Number.parseInt(params.get("size") ?? "", 10),
    });
    const keyword = params.get("keyword")?.trim();
    return { ...page, keyword: keyword || undefined };
  }, [search]);
  const identityKey = authState?.identityKey ?? "pending";
  const canImportProducts =
    hasAuthority(authorization, authority.productsWrite) &&
    hasAuthority(authorization, authority.filesWrite);
  const productCategoryRelation = useGlobalRecordListRelationFilter({
    apiClient,
    canUse: hasAuthority(authorization, authority.productsRead),
    filter: productCategoryRelationFilter,
    identityKey,
    searchParams,
    setSearchParams,
  });
  const canReadSavedViews = hasAuthority(authorization, authority.savedViewsRead);
  const canReadListFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const listFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "PRODUCT", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("PRODUCT"),
    enabled: apiClient !== null && canReadListFieldMetadata,
  });
  const productListColumnOptions = useMemo(
    () => [
      ...productColumnOptions,
      ...dynamicListColumnOptions(
        listFieldDefinitionsQuery.data ?? [],
        productColumnOptions.map((option) => option.code),
      ),
    ],
    [listFieldDefinitionsQuery.data],
  );
  const sort = useMemo(
    () => resolveProductListSort(requestedSort, listFieldDefinitionsQuery.data ?? []),
    [listFieldDefinitionsQuery.data, requestedSort],
  );
  const productSortOptions = useMemo(
    () => [
      ...productListSortOptions,
      ...productCustomSortOptions(listFieldDefinitionsQuery.data ?? []),
    ],
    [listFieldDefinitionsQuery.data],
  );
  const savedViewSelection = useMemo(() => savedViewSelectionFromSearch(search), [search]);
  const savedViewsQuery = useQuery({
    queryKey: savedViewKeys.list(identityKey, "PRODUCT", true),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("保存视图暂时不可用。"))
        : apiClient.listSavedViews("PRODUCT", true),
    enabled: apiClient !== null && canReadSavedViews,
  });
  const activeSavedView = resolveSavedView(savedViewsQuery.data ?? [], savedViewSelection);
  const productRequest = useMemo(
    () =>
      withProductListSort(
        withProductListScene(
          {
            ...request,
            categoryId: productCategoryRelation.confirmedId,
            ...(temporaryConditions.length > 0
              ? { conditions: temporaryConditions }
              : { savedViewId: activeSavedView?.id }),
          },
          scene,
        ),
        sort,
      ),
    [
      activeSavedView?.id,
      productCategoryRelation.confirmedId,
      request,
      scene,
      sort,
      temporaryConditions,
    ],
  );
  const productsQuery = useQuery({
    queryKey:
      temporaryConditions.length > 0
        ? productKeys.temporaryFilteredList(identityKey, productRequest)
        : productKeys.listRequest(identityKey, productRequest),
    queryFn: () =>
      apiClient?.getProducts(productRequest) ??
      Promise.reject(new Error("Products API is unavailable.")),
    enabled: apiClient !== null && productCategoryRelation.ready,
  });
  const exportMutation = useMutation({
    mutationFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Product CSV export is unavailable."))
        : apiClient.exportProductsCsv({
            fieldCodes: [...defaultProductExportFieldCodes],
            keyword: request.keyword,
            categoryId: productRequest.categoryId,
            availability: productRequest.availability,
            sortField: productRequest.sortField,
            customSortFieldCode: productRequest.customSortFieldCode,
            sortDirection: productRequest.sortDirection,
            ...(temporaryConditions.length > 0
              ? { conditions: temporaryConditions }
              : { savedViewId: activeSavedView?.id }),
          }),
    onSuccess: (download) => {
      saveControlledDownload(download);
      setExportOpen(false);
    },
  });
  const page: PageResult<ProductListItem> = productsQuery.data
    ? toPageResult(productsQuery.data, toProductListItem)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };
  const openProduct = useCallback(
    (product: ProductListItem) => {
      setSearchParams(updateSearch(searchParams, { productId: product.id }));
    },
    [searchParams, setSearchParams],
  );
  const closeProductDrawer = useCallback(() => {
    setSearchParams(updateSearch(searchParams, { productId: undefined }));
  }, [searchParams, setSearchParams]);
  const visibleColumns = useMemo(() => {
    const source = [
      ...columns(openProduct),
      ...dynamicListColumns<ProductListItem>(
        listFieldDefinitionsQuery.data ?? [],
        productColumnOptions.map((option) => option.code),
      ),
    ];
    const byCode = new Map(source.map((column) => [String(column.key), column]));
    const visible = visibleProductColumnCodes.flatMap((code) => {
      const column = byCode.get(code);
      return column === undefined ? [] : [column];
    });
    const action = byCode.get("actions");
    return action === undefined ? visible : [...visible, action];
  }, [listFieldDefinitionsQuery.data, openProduct, visibleProductColumnCodes]);
  const updateVisibleProductColumnCodes = useCallback((codes: readonly string[]) => {
    setVisibleProductColumnCodes((current) =>
      current.length === codes.length && current.every((code, index) => code === codes[index])
        ? current
        : codes,
    );
  }, []);

  function setPage(nextPage: number, nextSize: number) {
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setKeyword(keyword: string) {
    setSearchParams(updateSearch(searchParams, { keyword: keyword.trim() || undefined, page: 1 }));
  }

  function setScene(nextScene: ProductListScene) {
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        scene: nextScene === "all" ? undefined : nextScene,
      }),
    );
  }

  function setSort(nextSort: ProductListSort) {
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        sort: nextSort === defaultProductListSort ? undefined : nextSort,
      }),
    );
  }

  function setSavedView(selection: number | null) {
    setTemporaryConditions([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        savedView: selection === null ? "all" : selection,
      }),
    );
  }

  function clearFilters() {
    setTemporaryConditions([]);
    setSearchParams(
      updateSearch(searchParams, {
        categoryId: undefined,
        keyword: undefined,
        page: 1,
        scene: undefined,
        sort: undefined,
      }),
    );
  }

  function setTemporaryFilterConditions(
    conditions: components["schemas"]["FilterConditionRequest"][],
  ) {
    setTemporaryConditions(conditions);
  }

  function openExport() {
    exportMutation.reset();
    setExportOpen(true);
  }

  function closeExport() {
    if (exportMutation.isPending) return;
    exportMutation.reset();
    setExportOpen(false);
  }

  function completeProductImport(importedRows: number) {
    setImportOpen(false);
    setImportSuccessMessage(`已导入 ${importedRows} 条产品；重复产品编码已跳过。`);
    void queryClient.invalidateQueries({ queryKey: productKeys.lists(identityKey) });
  }

  return (
    <RouteAuthority authority={authority.productsRead}>
      <main>
        <PageHeader title="产品管理" />
        <FilterBar
          activeFilters={[
            ...(request.keyword
              ? [
                  {
                    key: "keyword",
                    label: `关键词：${request.keyword}`,
                    onClear: () => setKeyword(""),
                  },
                ]
              : []),
            ...(scene === "available"
              ? [{ key: "scene", label: "可用产品", onClear: () => setScene("all") }]
              : []),
            ...(scene === "unavailable"
              ? [{ key: "scene", label: "不可用产品", onClear: () => setScene("all") }]
              : []),
            ...(productCategoryRelation.activeFilter === undefined
              ? []
              : [productCategoryRelation.activeFilter]),
            ...(temporaryConditions.length > 0
              ? [
                  {
                    key: "temporary-conditions",
                    label: `高级筛选：${temporaryConditions.length} 条`,
                    onClear: () => setTemporaryConditions([]),
                  },
                ]
              : []),
            ...(sort !== defaultProductListSort
              ? [
                  {
                    key: "sort",
                    label: `排序：${productListSortLabel(sort, listFieldDefinitionsQuery.data ?? [])}`,
                    onClear: () => setSort(defaultProductListSort),
                  },
                ]
              : []),
          ]}
          search={{
            label: "搜索产品",
            placeholder: "搜索产品名称或编码",
            value: request.keyword,
            onSearch: setKeyword,
          }}
          trailing={
            <Space wrap>
              <Space aria-label="产品场景" size="small" wrap>
                <Button
                  type={scene === "all" ? "primary" : "default"}
                  onClick={() => setScene("all")}
                >
                  全部产品
                </Button>
                <Button
                  type={scene === "available" ? "primary" : "default"}
                  onClick={() => setScene("available")}
                >
                  可用
                </Button>
                <Button
                  type={scene === "unavailable" ? "primary" : "default"}
                  onClick={() => setScene("unavailable")}
                >
                  不可用
                </Button>
              </Space>
              {productCategoryRelation.controls}
              <Select<ProductListSort>
                aria-label="产品排序"
                options={productSortOptions}
                value={sort}
                onChange={setSort}
              />
              <SavedViewControls
                entityLabel="产品"
                objectType="PRODUCT"
                selection={savedViewSelection}
                onSelectionChange={setSavedView}
                temporaryConditions={temporaryConditions}
                onTemporaryConditionsChange={setTemporaryFilterConditions}
              />
              <ColumnPreferenceControls
                objectType="PRODUCT"
                options={productListColumnOptions}
                onVisibleCodesChange={updateVisibleProductColumnCodes}
              />
              <Button onClick={() => navigate("/crm/products/categories")}>分类管理</Button>
              <ActionAuthority authority={authority.productsExport}>
                <Button onClick={openExport}>导出 CSV</Button>
              </ActionAuthority>
              {canImportProducts ? (
                <Button onClick={() => setImportOpen(true)}>导入 CSV</Button>
              ) : null}
              <ActionAuthority authority={authority.productsWrite}>
                <Button type="primary" onClick={() => navigate("/crm/products/new")}>
                  新建产品
                </Button>
              </ActionAuthority>
            </Space>
          }
          onClearAll={
            request.keyword ||
            scene !== "all" ||
            productCategoryRelation.activeFilter !== undefined ||
            sort !== defaultProductListSort ||
            temporaryConditions.length > 0
              ? clearFilters
              : undefined
          }
        />
        <DataWorkspace
          errorMessage={
            productCategoryRelation.error instanceof ApiError
              ? productCategoryRelation.error.message
              : productCategoryRelation.error !== undefined
                ? "所选产品分类暂时无法确认，请重新选择"
                : productsQuery.isError
                  ? productsQuery.error instanceof ApiError
                    ? productsQuery.error.message
                    : "产品列表暂时无法加载"
                  : undefined
          }
          label="产品数据工作区"
        >
          {importSuccessMessage ? (
            <Typography.Text role="status" type="success">
              {importSuccessMessage}
            </Typography.Text>
          ) : null}
          <ResponsiveDataList
            columns={visibleColumns}
            loading={productsQuery.isLoading}
            page={page}
            rowKey={(product) => product.id}
            renderMobileItem={(product) => (
              <Card
                className={styles.mobileCard}
                size="small"
                title={
                  <Button
                    data-detail-trigger-id={product.id}
                    type="link"
                    onClick={() => openProduct(product)}
                  >
                    {product.name}
                  </Button>
                }
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{product.code ?? "未提供产品编码"}</Typography.Text>
                  <Typography.Text>{product.categoryName ?? "未提供产品分类"}</Typography.Text>
                  <div className={styles.mobileMeta}>
                    {product.unit ? <Tag>{`单位 ${product.unit}`}</Tag> : null}
                    {product.availability ? <Tag>{product.availability}</Tag> : null}
                    {product.status ? <Tag>{product.status}</Tag> : null}
                  </div>
                </Space>
              </Card>
            )}
            onPageChange={setPage}
          />
        </DataWorkspace>
        <Modal
          destroyOnHidden
          footer={
            <>
              <Button disabled={exportMutation.isPending} onClick={closeExport}>
                取消
              </Button>
              <Button
                loading={exportMutation.isPending}
                type="primary"
                onClick={() => exportMutation.mutate()}
              >
                导出 CSV
              </Button>
            </>
          }
          open={exportOpen}
          title="导出产品 CSV"
          onCancel={closeExport}
        >
          <Typography.Paragraph type="secondary">
            {request.keyword
              ? `将导出当前关键词“${request.keyword}”及已选筛选条件下服务端可见的产品。`
              : "将导出当前筛选条件下服务端可见的产品。"}
            首期固定导出“产品名称、产品编码、单位、可用性”列，字段、筛选条件和数据范围均由服务端再次校验。
          </Typography.Paragraph>
          {exportMutation.isError ? (
            <Alert
              title={
                exportMutation.error instanceof ApiError
                  ? exportMutation.error.message
                  : "产品导出暂时无法完成"
              }
              showIcon
              style={{ marginTop: 16 }}
              type="error"
            />
          ) : null}
        </Modal>
        {productCategoryRelation.modal}
        <CrmCsvImportModal
          apiClient={apiClient}
          identityKey={identityKey}
          objectType="PRODUCT"
          open={importOpen}
          onCancel={() => setImportOpen(false)}
          onCompleted={completeProductImport}
        />
        <ProductDetailDrawer
          open={selectedProductId !== null}
          productId={selectedProductId}
          onClose={closeProductDrawer}
        />
      </main>
    </RouteAuthority>
  );
}
