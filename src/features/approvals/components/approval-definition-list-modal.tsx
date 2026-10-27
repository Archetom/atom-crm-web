import { useQuery } from "@tanstack/react-query";
import { Alert, Button, List, Modal, Pagination, Space, Spin, Tag, Typography } from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";

import {
  approvalDefinitionObjectTypeLabels,
  approvalDefinitionStatusColors,
  approvalDefinitionStatusLabels,
} from "../model/approval-definition-labels";
import { type ApprovalDefinitionListItem } from "../model/approval-definition-list-item";
import { approvalDefinitionKeys } from "../model/approval-definition-query-keys";
import { ApprovalDefinitionCreateModal } from "./approval-definition-create-modal";
import { ApprovalDefinitionEditModal } from "./approval-definition-edit-modal";
import { ApprovalDefinitionStatusModal } from "./approval-definition-status-modal";

interface ApprovalDefinitionListModalProps {
  open: boolean;
  onClose: () => void;
}

const definitionPageSize = 20;

/**
 * Browses the service-authorized definition catalog without retaining routing
 * rules, member scopes, conditions, versions, or editable configuration.
 */
export function ApprovalDefinitionListModal({
  open,
  onClose,
}: Readonly<ApprovalDefinitionListModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingDefinitionId, setEditingDefinitionId] = useState<number | null>(null);
  const [selectedDefinition, setSelectedDefinition] = useState<ApprovalDefinitionListItem | null>(
    null,
  );
  const identityKey = authState?.identityKey ?? "approval-definitions";
  const canManageApprovals = hasAuthority(authorization, authority.approvalsManage);
  const definitionsQuery = useQuery({
    queryKey: approvalDefinitionKeys.list(identityKey, {
      page: currentPage,
      size: definitionPageSize,
    }),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("审批定义暂时不可用。"))
        : apiClient.getApprovalDefinitions({ page: currentPage, size: definitionPageSize }),
    enabled: open && apiClient !== null && canManageApprovals,
  });
  const page = definitionsQuery.data ?? { items: [], total: null };

  return (
    <>
      <Modal
        destroyOnHidden
        footer={null}
        open={open && !createOpen && editingDefinitionId === null && selectedDefinition === null}
        title="审批定义"
        onCancel={onClose}
      >
        <Typography.Paragraph type="secondary">
          仅显示服务端授权的定义目录。路由步骤、条件、成员与部门范围、重复规则、版本和时间均不会读取、展示或缓存；管理员可创建最小停用草稿，并仅在重新读取严格匹配的服务端基线后编辑最小模板或管理状态。
        </Typography.Paragraph>
        <Space style={{ marginBottom: 12 }}>
          <ActionAuthority authority={authority.approvalsManage}>
            <ActionAuthority authority={authority.organizationRead}>
              <Button type="primary" onClick={() => setCreateOpen(true)}>
                新建审批定义
              </Button>
            </ActionAuthority>
          </ActionAuthority>
        </Space>
        {definitionsQuery.isLoading ? <Spin /> : null}
        {definitionsQuery.isError ? (
          <Alert
            title={
              definitionsQuery.error instanceof ApiError
                ? definitionsQuery.error.message
                : "审批定义暂时无法加载"
            }
            showIcon
            type="error"
          />
        ) : null}
        <List<ApprovalDefinitionListItem>
          dataSource={page.items}
          loading={definitionsQuery.isFetching && !definitionsQuery.isLoading}
          locale={{ emptyText: definitionsQuery.isLoading ? "" : "暂无审批定义" }}
          renderItem={(definition) => (
            <List.Item
              actions={[
                <Button
                  key="edit"
                  size="small"
                  onClick={() => setEditingDefinitionId(definition.id)}
                >
                  编辑最小模板
                </Button>,
                <Button key="status" size="small" onClick={() => setSelectedDefinition(definition)}>
                  管理状态
                </Button>,
              ]}
            >
              <List.Item.Meta
                description={
                  <Space size={4} wrap>
                    <Tag>{approvalDefinitionObjectTypeLabels[definition.objectType]}</Tag>
                    <Tag color={approvalDefinitionStatusColors[definition.status]}>
                      {approvalDefinitionStatusLabels[definition.status]}
                    </Tag>
                  </Space>
                }
                title={definition.name}
              />
            </List.Item>
          )}
        />
        {page.total !== null && page.total > definitionPageSize ? (
          <Space style={{ marginTop: 12 }}>
            <Pagination
              current={currentPage}
              pageSize={definitionPageSize}
              showSizeChanger={false}
              total={page.total}
              onChange={(nextPage) => setCurrentPage(nextPage)}
            />
          </Space>
        ) : null}
      </Modal>
      <ApprovalDefinitionCreateModal
        open={open && createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <ApprovalDefinitionEditModal
        definitionId={open ? editingDefinitionId : null}
        onClose={() => setEditingDefinitionId(null)}
      />
      <ApprovalDefinitionStatusModal
        definitionId={open ? (selectedDefinition?.id ?? null) : null}
        definitionName={open ? (selectedDefinition?.name ?? null) : null}
        onClose={() => setSelectedDefinition(null)}
      />
    </>
  );
}
