import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Tree,
  Typography,
} from "antd";
import type { DataNode } from "antd/es/tree";
import { useEffect, useRef, useState, type Key } from "react";
import { useNavigate } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict } from "~/api/errors/mutation-conflict";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  MutationConflictNotice,
  type MutationConflictResolution,
} from "~/components/feedback/mutation-conflict-notice";

import type { ProductCategory } from "../model/product-category";
import { productCategoryKeys } from "../model/query-keys";

import styles from "./product-category-management-page.module.css";

interface CategoryCreateFormValues {
  name?: string;
}

interface CategoryEditFormValues {
  name?: string;
}

interface CategoryMoveFormValues {
  parentCategoryId?: number;
}

interface CategoryParentOption {
  category: ProductCategory;
  label: string;
}

const rootCategoryOptionValue = 0;

function toTreeData(
  categories: readonly ProductCategory[],
  onCreateChild: (parent: ProductCategory) => void,
  onEdit: (category: ProductCategory) => void,
  onMove: (category: ProductCategory) => void,
  onDelete: (category: ProductCategory) => void,
  deletingCategoryId: number | null,
  movableCategoryIds: ReadonlySet<number>,
): DataNode[] {
  return categories.map((category) => ({
    children: toTreeData(
      category.children,
      onCreateChild,
      onEdit,
      onMove,
      onDelete,
      deletingCategoryId,
      movableCategoryIds,
    ),
    key: String(category.id),
    title: (
      <Space size="small">
        <Typography.Text>{category.name}</Typography.Text>
        <Tag>{category.status}</Tag>
        <ActionAuthority authority={authority.productsWrite}>
          <Button
            size="small"
            type="link"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(category);
            }}
          >
            编辑名称
          </Button>
          {movableCategoryIds.has(category.id) ? (
            <Button
              size="small"
              type="link"
              onClick={(event) => {
                event.stopPropagation();
                onMove(category);
              }}
            >
              移动分类
            </Button>
          ) : null}
          <Button
            size="small"
            type="link"
            onClick={(event) => {
              event.stopPropagation();
              onCreateChild(category);
            }}
          >
            新建子分类
          </Button>
        </ActionAuthority>
        <ActionAuthority authority={authority.productsDelete}>
          <Popconfirm
            cancelText="取消"
            description="删除后分类不再可用。服务端会再次确认当前版本，且该分类没有活动子节点或产品依赖。"
            okButtonProps={{ danger: true }}
            okText="确认删除"
            title={`删除分类“${category.name}”？`}
            onConfirm={() => onDelete(category)}
          >
            <Button
              danger
              disabled={deletingCategoryId !== null}
              loading={deletingCategoryId === category.id}
              size="small"
              type="link"
            >
              删除分类
            </Button>
          </Popconfirm>
        </ActionAuthority>
      </Space>
    ),
  }));
}

function categoryKeys(categories: readonly ProductCategory[]): Key[] {
  return categories.flatMap((category) => [category.id, ...categoryKeys(category.children)]);
}

function findCategory(
  categories: readonly ProductCategory[],
  categoryId: number,
): ProductCategory | null {
  for (const category of categories) {
    if (category.id === categoryId) return category;
    const child = findCategory(category.children, categoryId);
    if (child !== null) return child;
  }

  return null;
}

function categoryDescendantIds(category: ProductCategory): ReadonlySet<number> {
  const descendantIds = new Set<number>();

  function collect(children: readonly ProductCategory[]) {
    for (const child of children) {
      descendantIds.add(child.id);
      collect(child.children);
    }
  }

  collect(category.children);
  return descendantIds;
}

function categoryParentOptions(
  categories: readonly ProductCategory[],
): readonly CategoryParentOption[] {
  const options: CategoryParentOption[] = [];

  function collect(values: readonly ProductCategory[], ancestors: readonly string[]) {
    for (const value of values) {
      const label = [...ancestors, value.name].join(" / ");
      options.push({ category: value, label });
      collect(value.children, [...ancestors, value.name]);
    }
  }

  collect(categories, []);
  return options;
}

function moveParentOptions(
  parentOptions: readonly CategoryParentOption[],
  movingCategory: ProductCategory,
): readonly CategoryParentOption[] {
  const descendantIds = categoryDescendantIds(movingCategory);

  return parentOptions.filter(
    ({ category }) =>
      category.id !== movingCategory.id &&
      category.id !== movingCategory.parentCategoryId &&
      !descendantIds.has(category.id),
  );
}

function canMoveCategory(
  parentOptions: readonly CategoryParentOption[],
  category: ProductCategory,
): boolean {
  return (
    category.parentCategoryId !== null ||
    parentOptions.length > categoryDescendantIds(category).size + 1
  );
}

export function ProductCategoryManagementPage() {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [parentCategory, setParentCategory] = useState<ProductCategory | null>(null);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [movingCategory, setMovingCategory] = useState<ProductCategory | null>(null);
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<Key[]>([]);
  const initializedExpansion = useRef(false);
  const [form] = Form.useForm<CategoryCreateFormValues>();
  const [editForm] = Form.useForm<CategoryEditFormValues>();
  const [moveForm] = Form.useForm<CategoryMoveFormValues>();
  const identityKey = authState?.identityKey ?? "pending";
  const categoriesQuery = useQuery({
    queryKey: productCategoryKeys.tree(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Product categories API is unavailable."))
        : apiClient.getProductCategories(),
    enabled: apiClient !== null,
  });
  const createMutation = useMutation({
    mutationFn: ({ name, parentCategoryId }: { name: string; parentCategoryId?: number }) =>
      apiClient === null
        ? Promise.reject(new Error("Product category creation is unavailable."))
        : apiClient.createProductCategory({
            name: name.trim(),
            ...(parentCategoryId === undefined ? {} : { parentCategoryId }),
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productCategoryKeys.tree(identityKey) });
      form.resetFields();
      if (parentCategory !== null) {
        setExpandedCategoryKeys((current) =>
          current.includes(parentCategory.id) ? current : [...current, parentCategory.id],
        );
      }
      setParentCategory(null);
      setCreateOpen(false);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ category, name }: { category: ProductCategory; name: string }) =>
      apiClient === null
        ? Promise.reject(new Error("Product category update is unavailable."))
        : apiClient.updateProductCategory(category.id, {
            name: name.trim(),
            ...(category.parentCategoryId === null
              ? {}
              : { parentCategoryId: category.parentCategoryId }),
            version: category.version,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productCategoryKeys.tree(identityKey) });
      editForm.resetFields();
      setEditingCategory(null);
    },
  });
  const moveMutation = useMutation({
    mutationFn: ({
      category,
      parentCategoryId,
    }: {
      category: ProductCategory;
      parentCategoryId: number | null;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("Product category move is unavailable."))
        : apiClient.updateProductCategory(category.id, {
            name: category.name,
            ...(parentCategoryId === null ? {} : { parentCategoryId }),
            version: category.version,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productCategoryKeys.tree(identityKey) });
      moveForm.resetFields();
      setMovingCategory(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (category: ProductCategory) =>
      apiClient === null
        ? Promise.reject(new Error("Product category delete is unavailable."))
        : apiClient.deleteProductCategory(category.id, category.version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productCategoryKeys.tree(identityKey) });
    },
  });

  useEffect(() => {
    if (categoriesQuery.data === undefined || initializedExpansion.current) return;

    setExpandedCategoryKeys(categoryKeys(categoriesQuery.data));
    initializedExpansion.current = true;
  }, [categoriesQuery.data]);

  function openCreate(parent: ProductCategory | null) {
    createMutation.reset();
    form.resetFields();
    setParentCategory(parent);
    setCreateOpen(true);
  }

  function closeCreate() {
    form.resetFields();
    setParentCategory(null);
    setCreateOpen(false);
  }

  function openEdit(category: ProductCategory) {
    updateMutation.reset();
    editForm.setFieldsValue({ name: category.name });
    setEditingCategory(category);
  }

  function closeEdit() {
    if (updateMutation.isPending) return;
    updateMutation.reset();
    editForm.resetFields();
    setEditingCategory(null);
  }

  function openMove(category: ProductCategory) {
    moveMutation.reset();
    moveForm.resetFields();
    setMovingCategory(category);
  }

  function closeMove() {
    if (moveMutation.isPending) return;
    moveMutation.reset();
    moveForm.resetFields();
    setMovingCategory(null);
  }

  function createCategory(values: CategoryCreateFormValues) {
    if (values.name === undefined || values.name.trim().length === 0) return;
    createMutation.mutate({
      name: values.name,
      ...(parentCategory === null ? {} : { parentCategoryId: parentCategory.id }),
    });
  }

  function updateCategory(values: CategoryEditFormValues) {
    if (editingCategory === null || values.name === undefined || values.name.trim().length === 0) {
      return;
    }

    updateMutation.mutate({ category: editingCategory, name: values.name });
  }

  function moveCategory(values: CategoryMoveFormValues) {
    if (movingCategory === null || values.parentCategoryId === undefined) return;

    moveMutation.mutate({
      category: movingCategory,
      parentCategoryId:
        values.parentCategoryId === rootCategoryOptionValue ? null : values.parentCategoryId,
    });
  }

  function deleteCategory(category: ProductCategory) {
    deleteMutation.reset();
    deleteMutation.mutate(category);
  }

  async function resolveUpdateConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      updateMutation.reset();
      return;
    }

    const result = await categoriesQuery.refetch();
    updateMutation.reset();
    if (editingCategory === null || result.data === undefined) return;

    const latest = findCategory(result.data, editingCategory.id);
    if (resolution === "keep-draft-and-reload" && latest !== null) {
      setEditingCategory(latest);
      return;
    }

    editForm.resetFields();
    setEditingCategory(null);
  }

  async function resolveMoveConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      moveMutation.reset();
      return;
    }

    const result = await categoriesQuery.refetch();
    moveMutation.reset();
    if (movingCategory === null || result.data === undefined) return;

    const latest = findCategory(result.data, movingCategory.id);
    if (resolution === "keep-draft-and-reload" && latest !== null) {
      const selectedParentId = moveForm.getFieldValue("parentCategoryId");
      const stillValid =
        selectedParentId === rootCategoryOptionValue
          ? latest.parentCategoryId !== null
          : moveParentOptions(categoryParentOptions(result.data), latest).some(
              ({ category }) => category.id === selectedParentId,
            );
      if (!stillValid) moveForm.resetFields();
      setMovingCategory(latest);
      return;
    }

    moveForm.resetFields();
    setMovingCategory(null);
  }

  async function resolveDeleteConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      deleteMutation.reset();
      return;
    }

    await categoriesQuery.refetch();
    deleteMutation.reset();
  }

  const updateConflict = getMutationConflict(updateMutation.error);
  const moveConflict = getMutationConflict(moveMutation.error);
  const deleteConflict = getMutationConflict(deleteMutation.error);
  const categoryTree = categoriesQuery.data ?? [];
  const categoryParents = categoryParentOptions(categoryTree);
  const movableCategoryIds = new Set(
    categoryParents
      .map(({ category }) => category)
      .filter((category) => canMoveCategory(categoryParents, category))
      .map((category) => category.id),
  );
  const movingParentOptions =
    movingCategory === null ? [] : moveParentOptions(categoryParents, movingCategory);

  return (
    <RouteAuthority authority={authority.productsRead}>
      <main className={styles.page}>
        <section className={styles.header}>
          <div>
            <Typography.Title level={2}>产品分类管理</Typography.Title>
            <Typography.Text type="secondary">
              分类层级和状态只来自服务端树。可在已返回节点下创建子分类或移动节点，不从本地推断父级。
            </Typography.Text>
          </div>
          <Space wrap>
            <Button onClick={() => navigate("/crm/products")}>返回产品目录</Button>
            <ActionAuthority authority={authority.productsWrite}>
              <Button type="primary" onClick={() => openCreate(null)}>
                新建根分类
              </Button>
            </ActionAuthority>
          </Space>
        </section>
        {categoriesQuery.isError ? (
          <Alert
            title={
              categoriesQuery.error instanceof ApiError
                ? categoriesQuery.error.message
                : "产品分类目录暂时无法加载"
            }
            showIcon
            type="error"
          />
        ) : null}
        {createMutation.isError ? (
          <Alert
            title={
              createMutation.error instanceof ApiError
                ? createMutation.error.message
                : "产品分类暂时无法创建"
            }
            showIcon
            type="error"
          />
        ) : null}
        {deleteMutation.isError && deleteConflict === null ? (
          <Alert
            title={
              deleteMutation.error instanceof ApiError
                ? deleteMutation.error.message
                : "产品分类暂时无法删除"
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
        <Card loading={categoriesQuery.isLoading} title="服务端分类树">
          <Tree
            blockNode
            expandedKeys={expandedCategoryKeys}
            treeData={toTreeData(
              categoryTree,
              (parent) => openCreate(parent),
              (category) => openEdit(category),
              (category) => openMove(category),
              deleteCategory,
              deleteMutation.variables?.id ?? null,
              movableCategoryIds,
            )}
            onExpand={(keys) => setExpandedCategoryKeys(keys)}
          />
          {!categoriesQuery.isLoading && categoriesQuery.data?.length === 0 ? (
            <Typography.Text type="secondary">暂未返回可见产品分类。</Typography.Text>
          ) : null}
        </Card>
      </main>
      <Modal
        destroyOnHidden
        footer={null}
        open={createOpen}
        title={parentCategory === null ? "新建根分类" : "新建子分类"}
        onCancel={closeCreate}
      >
        <Typography.Paragraph type="secondary">
          {parentCategory === null
            ? "此操作只提交分类名称。"
            : `此操作只提交分类名称和服务端树返回的父级「${parentCategory.name}」。`}
          移动、编辑与删除需要服务端当前版本基线，将在后续切片提供。
        </Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={createCategory}>
          <Form.Item
            label="分类名称"
            name="name"
            rules={[
              { required: true, whitespace: true, message: "请输入分类名称" },
              { max: 200, message: "分类名称不能超过 200 个字符" },
            ]}
          >
            <Input aria-label="分类名称" maxLength={200} placeholder="请输入分类名称" />
          </Form.Item>
          <Space>
            <Button onClick={closeCreate}>取消</Button>
            <Button htmlType="submit" loading={createMutation.isPending} type="primary">
              创建分类
            </Button>
          </Space>
        </Form>
      </Modal>
      <Modal
        destroyOnHidden
        footer={null}
        open={editingCategory !== null}
        title="编辑分类名称"
        onCancel={closeEdit}
      >
        <Typography.Paragraph type="secondary">
          此操作只更新名称，并保留服务端分类树返回的当前父级与 version；移动层级将在独立切片提供。
        </Typography.Paragraph>
        <Form form={editForm} layout="vertical" onFinish={updateCategory}>
          <Form.Item
            label="分类名称"
            name="name"
            rules={[
              { required: true, whitespace: true, message: "请输入分类名称" },
              { max: 200, message: "分类名称不能超过 200 个字符" },
            ]}
          >
            <Input aria-label="分类名称" maxLength={200} placeholder="请输入分类名称" />
          </Form.Item>
          {updateMutation.isError && updateConflict === null ? (
            <Alert
              title={
                updateMutation.error instanceof ApiError
                  ? updateMutation.error.message
                  : "产品分类暂时无法更新"
              }
              showIcon
              type="error"
            />
          ) : null}
          {updateMutation.isError ? (
            <MutationConflictNotice
              error={updateMutation.error}
              onResolve={(resolution) => void resolveUpdateConflict(resolution)}
            />
          ) : null}
          <Space>
            <Button onClick={closeEdit}>取消</Button>
            <Button htmlType="submit" loading={updateMutation.isPending} type="primary">
              保存名称
            </Button>
          </Space>
        </Form>
      </Modal>
      <Modal
        destroyOnHidden
        footer={null}
        open={movingCategory !== null}
        title="移动分类"
        onCancel={closeMove}
      >
        <Typography.Paragraph type="secondary">
          移动「{movingCategory?.name}」时只提交服务端树返回的名称、目标父级与当前 version。
          当前父级、自身和全部后代不会作为候选；服务端仍会复核环路与层级深度。
        </Typography.Paragraph>
        <Form form={moveForm} layout="vertical" onFinish={moveCategory}>
          <Form.Item
            label="目标父级"
            name="parentCategoryId"
            rules={[{ required: true, message: "请选择目标父级" }]}
          >
            <Select
              aria-label="目标父级"
              optionFilterProp="label"
              placeholder="请选择目标父级"
              showSearch
            >
              {movingCategory !== null && movingCategory.parentCategoryId !== null ? (
                <Select.Option label="根分类" value={rootCategoryOptionValue}>
                  根分类
                </Select.Option>
              ) : null}
              {movingParentOptions.map(({ category, label }) => (
                <Select.Option key={category.id} label={label} value={category.id}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          {moveMutation.isError && moveConflict === null ? (
            <Alert
              title={
                moveMutation.error instanceof ApiError
                  ? moveMutation.error.message
                  : "产品分类暂时无法移动"
              }
              showIcon
              type="error"
            />
          ) : null}
          {moveMutation.isError ? (
            <MutationConflictNotice
              error={moveMutation.error}
              onResolve={(resolution) => void resolveMoveConflict(resolution)}
            />
          ) : null}
          <Space>
            <Button onClick={closeMove}>取消</Button>
            <Button htmlType="submit" loading={moveMutation.isPending} type="primary">
              确认移动
            </Button>
          </Space>
        </Form>
      </Modal>
    </RouteAuthority>
  );
}
