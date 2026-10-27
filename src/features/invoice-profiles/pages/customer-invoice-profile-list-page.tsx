import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Input, List, Modal, Popconfirm, Spin, Tag, Typography } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { StatusPage } from "~/components/feedback/status-page";

import { invoiceProfileKeys } from "../model/query-keys";
import type { InvoiceProfileListItem } from "../model/invoice-profile-list-item";
import { toPersonalInvoiceProfileTitleUpdateRequest } from "../model/invoice-profile-form";

import styles from "./customer-invoice-profile-list-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

export function CustomerInvoiceProfileListPage() {
  const { customerId: customerIdParam } = useParams();
  const customerId = parseRouteId(customerIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const [deletingProfileId, setDeletingProfileId] = useState<number | null>(null);
  const [editingProfile, setEditingProfile] = useState<InvoiceProfileListItem | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const canReadInvoices = hasAuthority(authorization, authority.invoicesRead);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const profilesQuery = useQuery({
    queryKey:
      customerId === null
        ? invoiceProfileKeys.list(identityKey, { customerId: 0 })
        : invoiceProfileKeys.list(identityKey, { customerId }),
    queryFn: () =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Invoice profiles are unavailable."))
        : apiClient.getInvoiceProfiles(customerId),
    enabled: apiClient !== null && customerId !== null && canReadInvoices && canReadCustomers,
  });
  const deleteMutation = useMutation({
    mutationFn: ({ profileId, version }: { profileId: number; version: number }) =>
      apiClient === null
        ? Promise.reject(new Error("Invoice profile deletion is unavailable."))
        : apiClient.deleteInvoiceProfile(profileId, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceProfileKeys.lists(identityKey) });
    },
    onSettled: () => setDeletingProfileId(null),
  });
  const updateMutation = useMutation({
    mutationFn: ({
      profileId,
      title,
      version,
    }: {
      profileId: number;
      title: string;
      version: number;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("Invoice profile update is unavailable."))
        : apiClient.updateInvoiceProfile(
            profileId,
            toPersonalInvoiceProfileTitleUpdateRequest({ title, version }),
          ),
    onSuccess: (profile) => {
      if (profile.customerId === customerId) {
        queryClient.setQueryData<readonly InvoiceProfileListItem[]>(
          invoiceProfileKeys.list(identityKey, { customerId }),
          (current) => current?.map((item) => (item.id === profile.id ? profile : item)) ?? current,
        );
      }
      void queryClient.invalidateQueries({ queryKey: invoiceProfileKeys.lists(identityKey) });
      setEditingProfile(null);
      setEditingTitle("");
    },
  });

  function openPersonalTitleEditor(profile: InvoiceProfileListItem) {
    updateMutation.reset();
    setEditingProfile(profile);
    setEditingTitle(profile.title);
  }

  function closePersonalTitleEditor() {
    if (updateMutation.isPending) return;
    updateMutation.reset();
    setEditingProfile(null);
    setEditingTitle("");
  }

  if (customerId === null) return <StatusPage kind="not-found" />;

  const profiles = profilesQuery.data;
  const hasMismatchedCustomer =
    profiles?.some((profile) => profile.customerId !== customerId) === true;
  const normalizedEditingTitle = editingTitle.trim();
  const canSavePersonalTitle =
    editingProfile !== null &&
    normalizedEditingTitle.length > 0 &&
    normalizedEditingTitle.length <= 200 &&
    normalizedEditingTitle !== editingProfile.title;

  return (
    <RouteAuthority authority={authority.invoicesRead}>
      <RouteAuthority authority={authority.customersRead}>
        <main className={styles.page}>
          <section className={styles.heading}>
            <div>
              <Button
                icon={<ArrowLeftOutlined />}
                type="link"
                onClick={() => navigate(`/crm/customers/${customerId}`)}
              >
                返回客户详情
              </Button>
              <Typography.Title level={2}>开票资料</Typography.Title>
              <Typography.Text type="secondary">
                仅显示服务端确认当前客户可见范围内的抬头信息；银行账户、地址、电话和备注不进入列表投影。
              </Typography.Text>
            </div>
            <ActionAuthority authority={authority.invoicesWrite}>
              <ActionAuthority authority={authority.customersRead}>
                <Button
                  type="primary"
                  onClick={() => navigate(`/crm/customers/${customerId}/invoice-profiles/new`)}
                >
                  新建个人抬头
                </Button>
              </ActionAuthority>
            </ActionAuthority>
          </section>
          {profilesQuery.isLoading ? (
            <div
              aria-label="正在加载开票资料"
              style={{ display: "grid", minHeight: 160, placeItems: "center" }}
            >
              <Spin size="large" />
            </div>
          ) : null}
          {profilesQuery.isError ? (
            <Alert
              title={
                profilesQuery.error instanceof ApiError
                  ? profilesQuery.error.message
                  : "开票资料暂时无法加载"
              }
              showIcon
              type="error"
            />
          ) : null}
          {deleteMutation.isError ? (
            <Alert
              title={
                deleteMutation.error instanceof ApiError
                  ? deleteMutation.error.message
                  : "开票资料暂时无法删除"
              }
              showIcon
              type="error"
            />
          ) : null}
          {!profilesQuery.isLoading && !profilesQuery.isError && hasMismatchedCustomer ? (
            <StatusPage kind="not-found" />
          ) : null}
          {!profilesQuery.isLoading && !profilesQuery.isError && !hasMismatchedCustomer ? (
            <Card title="当前客户开票资料">
              <List
                dataSource={[...(profiles ?? [])]}
                locale={{ emptyText: "暂无开票资料" }}
                renderItem={(profile) => (
                  <List.Item
                    actions={[
                      profile.titleType === "INDIVIDUAL" ? (
                        <ActionAuthority authority={authority.invoicesWrite} key="edit">
                          <Button type="link" onClick={() => openPersonalTitleEditor(profile)}>
                            编辑个人抬头
                          </Button>
                        </ActionAuthority>
                      ) : null,
                      <ActionAuthority authority={authority.invoicesDelete} key="delete">
                        <Popconfirm
                          cancelText="取消"
                          description="删除后资料会进入服务端软删除状态，且不能自动恢复。"
                          okButtonProps={{ danger: true }}
                          okText="确认删除"
                          title={`删除开票资料“${profile.title}”？`}
                          onConfirm={() => {
                            deleteMutation.reset();
                            setDeletingProfileId(profile.id);
                            deleteMutation.mutate({
                              profileId: profile.id,
                              version: profile.version,
                            });
                          }}
                        >
                          <Button
                            danger
                            disabled={deleteMutation.isPending}
                            loading={deletingProfileId === profile.id && deleteMutation.isPending}
                            type="link"
                          >
                            删除
                          </Button>
                        </Popconfirm>
                      </ActionAuthority>,
                    ]}
                  >
                    <List.Item.Meta
                      description={
                        <Typography.Text type="secondary">
                          {profile.taxNumber === null ? "未提供税号" : `税号 ${profile.taxNumber}`}{" "}
                          · 更新于 {profile.updatedTime ?? "未提供"}
                        </Typography.Text>
                      }
                      title={
                        <span>
                          {profile.title} <Tag>{profile.titleType}</Tag>
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          ) : null}
          <Modal
            destroyOnHidden
            footer={
              <>
                <Button disabled={updateMutation.isPending} onClick={closePersonalTitleEditor}>
                  取消
                </Button>
                <Button
                  disabled={!canSavePersonalTitle}
                  loading={updateMutation.isPending}
                  type="primary"
                  onClick={() => {
                    if (editingProfile === null || !canSavePersonalTitle) return;
                    updateMutation.mutate({
                      profileId: editingProfile.id,
                      title: normalizedEditingTitle,
                      version: editingProfile.version,
                    });
                  }}
                >
                  保存修改
                </Button>
              </>
            }
            open={editingProfile !== null}
            title="编辑个人抬头"
            onCancel={closePersonalTitleEditor}
          >
            <Typography.Paragraph type="secondary">
              仅提交本次修改的个人抬头和服务端回显的
              version；税号、银行账户、注册地址、电话和备注不会读取、展示或写入。
            </Typography.Paragraph>
            <Input
              aria-label="开票抬头"
              disabled={updateMutation.isPending}
              maxLength={200}
              placeholder="请输入个人开票抬头"
              value={editingTitle}
              onChange={(event) => setEditingTitle(event.target.value)}
            />
            {updateMutation.isError ? (
              <Alert
                title={
                  updateMutation.error instanceof ApiError
                    ? updateMutation.error.message
                    : "开票资料暂时无法更新"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
          </Modal>
        </main>
      </RouteAuthority>
    </RouteAuthority>
  );
}
