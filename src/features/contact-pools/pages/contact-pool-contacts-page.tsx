import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  normalizePageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";
import { DataWorkspace } from "~/components/page/data-workspace";
import { FilterBar } from "~/components/page/filter-bar";
import { PageHeader } from "~/components/page/page-header";
import { contactKeys } from "~/features/contacts";

import {
  toContactPoolContactListItem,
  type ContactPoolContactListItem,
} from "../model/contact-pool-contact-list-item";
import { contactPoolKeys } from "../model/query-keys";

import styles from "./contact-pool-contacts-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

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

interface ClaimContactActionProps {
  contact: ContactPoolContactListItem;
  isPending: boolean;
  onClaim(contact: ContactPoolContactListItem): void;
}

interface AssignContactActionProps {
  contact: ContactPoolContactListItem;
  poolAdministrator: boolean;
  onAssign(contact: ContactPoolContactListItem): void;
}

interface DeleteContactActionProps {
  contact: ContactPoolContactListItem;
  isPending: boolean;
  poolAdministrator: boolean;
  onDelete(contact: ContactPoolContactListItem): void;
}

function ClaimContactAction({ contact, isPending, onClaim }: Readonly<ClaimContactActionProps>) {
  if (contact.status !== "IN_POOL") return null;

  return (
    <ActionAuthority authority={authority.contactPoolsClaim}>
      <Popconfirm
        cancelText="取消"
        okText="确认领取"
        title={`确认领取联系人“${contact.name}”吗？`}
        onConfirm={() => onClaim(contact)}
      >
        <Button disabled={isPending} type="link">
          领取
        </Button>
      </Popconfirm>
    </ActionAuthority>
  );
}

function AssignContactAction({
  contact,
  poolAdministrator,
  onAssign,
}: Readonly<AssignContactActionProps>) {
  if (contact.status !== "IN_POOL" || !poolAdministrator) return null;

  return (
    <ActionAuthority authority={authority.contactPoolsAssign}>
      <Button type="link" onClick={() => onAssign(contact)}>
        分配
      </Button>
    </ActionAuthority>
  );
}

function DeleteContactAction({
  contact,
  isPending,
  poolAdministrator,
  onDelete,
}: Readonly<DeleteContactActionProps>) {
  if (contact.status !== "IN_POOL" || !poolAdministrator) return null;

  return (
    <ActionAuthority authority={authority.contactPoolsDelete}>
      <Popconfirm
        cancelText="取消"
        description="删除后联系人会进入服务端软删除状态，且无法再从此公海领取或分配。"
        okButtonProps={{ danger: true }}
        okText="确认删除"
        title={`确认删除联系人“${contact.name}”吗？`}
        onConfirm={() => onDelete(contact)}
      >
        <Button danger disabled={isPending} type="link">
          删除
        </Button>
      </Popconfirm>
    </ActionAuthority>
  );
}

function columns(
  canReadContactDetails: boolean,
  isClaimPending: boolean,
  isDeletePending: boolean,
  poolAdministrator: boolean,
  onClaim: (contact: ContactPoolContactListItem) => void,
  onAssign: (contact: ContactPoolContactListItem) => void,
  onDelete: (contact: ContactPoolContactListItem) => void,
): ColumnsType<ContactPoolContactListItem> {
  return [
    {
      dataIndex: "name",
      key: "name",
      title: "联系人姓名",
      render: (name: string, contact) =>
        canReadContactDetails ? <Link to={`/crm/contacts/${contact.id}`}>{name}</Link> : name,
    },
    {
      dataIndex: "jobTitle",
      key: "jobTitle",
      title: "职务",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "phoneNumber",
      key: "phoneNumber",
      title: "联系电话",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "customerId",
      key: "customerId",
      title: "关联客户",
      render: (value: number | null) => (value === null ? "—" : `客户 ${value}`),
    },
    {
      dataIndex: "ownerActorId",
      key: "ownerActorId",
      title: "负责人",
      render: (value: number | null) => (value === null ? "—" : `成员 ${value}`),
    },
    {
      dataIndex: "status",
      key: "status",
      title: "状态",
      render: (value: string | null) => value ?? "—",
    },
    {
      key: "actions",
      title: "操作",
      render: (_, contact) => (
        <Space size="small">
          <ClaimContactAction contact={contact} isPending={isClaimPending} onClaim={onClaim} />
          <AssignContactAction
            contact={contact}
            poolAdministrator={poolAdministrator}
            onAssign={onAssign}
          />
          <DeleteContactAction
            contact={contact}
            isPending={isDeletePending}
            poolAdministrator={poolAdministrator}
            onDelete={onDelete}
          />
        </Space>
      ),
    },
  ];
}

export function ContactPoolContactsPage() {
  const { poolId: poolIdParam } = useParams();
  const poolId = parseRouteId(poolIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assignContacts, setAssignContacts] = useState<readonly ContactPoolContactListItem[]>([]);
  const [assigneeKeyword, setAssigneeKeyword] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<ContactPoolContactListItem[]>([]);
  const search = searchParams.toString();
  const request = useMemo(() => {
    const params = new URLSearchParams(search);
    const page = normalizePageRequest({
      page: Number.parseInt(params.get("page") ?? "", 10),
      size: Number.parseInt(params.get("size") ?? "", 10),
    });
    const name = params.get("name")?.trim();
    return { ...page, name: name || undefined };
  }, [search]);
  const identityKey = authState?.identityKey ?? "pending";
  const catalogQuery = useQuery({
    queryKey: contactPoolKeys.catalog(identityKey),
    queryFn: () =>
      apiClient?.getContactPoolCatalog() ??
      Promise.reject(new Error("Contact pool catalog API is unavailable.")),
    enabled: apiClient !== null && poolId !== null,
  });
  const pool = catalogQuery.data?.find((pool) => pool.id === poolId);
  const contactsQuery = useQuery({
    queryKey:
      poolId === null
        ? contactPoolKeys.contacts(identityKey, 0, request)
        : contactPoolKeys.contacts(identityKey, poolId, request),
    queryFn: () =>
      poolId === null || apiClient === null
        ? Promise.reject(new Error("Contact pool contacts API is unavailable."))
        : apiClient.getContactPoolContacts(poolId, request),
    enabled: apiClient !== null && pool !== undefined,
  });
  const claimMutation = useMutation({
    mutationFn: (contacts: readonly ContactPoolContactListItem[]) =>
      poolId === null || apiClient === null
        ? Promise.reject(new Error("Contact-pool claim API is unavailable."))
        : apiClient.claimContactFromPool(poolId, {
            contacts: contacts.map((contact) => ({
              contactId: contact.id,
              version: contact.version,
            })),
          }),
    onSuccess: () => {
      setSelectedContacts([]);
      void queryClient.invalidateQueries({ queryKey: contactPoolKeys.all });
      void queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
    },
  });
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const assigneeQuery = useQuery({
    queryKey: ["member-selector", "contact-pool-assign", identityKey, assigneeKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Contact-pool assignee selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: assigneeKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && assignContacts.length > 0 && canReadOrganization,
  });
  const assignMutation = useMutation({
    mutationFn: ({
      contacts,
      ownerActorId,
    }: {
      contacts: readonly ContactPoolContactListItem[];
      ownerActorId: number;
    }) =>
      poolId === null || apiClient === null
        ? Promise.reject(new Error("Contact-pool assign API is unavailable."))
        : apiClient.assignContactFromPool(poolId, {
            ownerActorId,
            contacts: contacts.map((contact) => ({
              contactId: contact.id,
              version: contact.version,
            })),
          }),
    onSuccess: () => {
      setSelectedContacts([]);
      void queryClient.invalidateQueries({ queryKey: contactPoolKeys.all });
      void queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
      setAssignContacts([]);
      setAssigneeKeyword("");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (contacts: readonly ContactPoolContactListItem[]) =>
      poolId === null || apiClient === null
        ? Promise.reject(new Error("Contact-pool delete API is unavailable."))
        : apiClient.deleteContactFromPool(poolId, {
            contacts: contacts.map((contact) => ({
              contactId: contact.id,
              version: contact.version,
            })),
          }),
    onSuccess: () => {
      setSelectedContacts([]);
      void queryClient.invalidateQueries({ queryKey: contactPoolKeys.all });
      void queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
    },
  });
  const page: PageResult<ContactPoolContactListItem> = contactsQuery.data
    ? toPageResult(contactsQuery.data, toContactPoolContactListItem)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };
  const canReadContactDetails = hasAuthority(authorization, authority.contactsRead);
  const canClaimContacts = hasAuthority(authorization, authority.contactPoolsClaim);
  const canAssignContacts =
    pool?.administrator === true && hasAuthority(authorization, authority.contactPoolsAssign);
  const canDeleteContacts =
    pool?.administrator === true && hasAuthority(authorization, authority.contactPoolsDelete);
  const canSelectContacts = canClaimContacts || canAssignContacts || canDeleteContacts;
  const contactRowSelection: TableProps<ContactPoolContactListItem>["rowSelection"] =
    canSelectContacts
      ? {
          selectedRowKeys: selectedContacts.map((contact) => contact.id),
          getCheckboxProps: (contact) => ({ disabled: contact.status !== "IN_POOL" }),
          onChange: (_, contacts) => setSelectedContacts(contacts),
        }
      : undefined;

  function setPage(nextPage: number, nextSize: number) {
    setSelectedContacts([]);
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setName(name: string) {
    setSelectedContacts([]);
    setSearchParams(updateSearch(searchParams, { name: name.trim() || undefined, page: 1 }));
  }

  function claimContact(contact: ContactPoolContactListItem) {
    claimMutation.mutate([contact]);
  }

  function deleteContact(contact: ContactPoolContactListItem) {
    deleteMutation.mutate([contact]);
  }

  function openAssignPicker(contacts: readonly ContactPoolContactListItem[]) {
    assignMutation.reset();
    setAssigneeKeyword("");
    setAssignContacts(contacts);
  }

  function closeAssignPicker() {
    if (assignMutation.isPending) return;
    assignMutation.reset();
    setAssignContacts([]);
    setAssigneeKeyword("");
  }

  if (poolId === null) return <StatusPage kind="not-found" />;

  if (catalogQuery.isLoading) {
    return (
      <div
        aria-label="正在加载联系人公海"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (catalogQuery.isError) {
    return <StatusPage kind={statusKindFromError(catalogQuery.error)} />;
  }

  if (pool === undefined) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.contactPoolsRead}>
      <main>
        <PageHeader
          description={
            <>
              <Link to="/crm/contact-pools">返回联系人公海</Link>
              {` · ${pool.name}。列表、字段遮罩和客户关联范围均以服务端返回为准。`}
            </>
          }
          title="公海联系人"
        />
        <FilterBar
          activeFilters={
            request.name
              ? [
                  {
                    key: "name",
                    label: `关键词：${request.name}`,
                    onClear: () => setName(""),
                  },
                ]
              : []
          }
          search={{
            label: "搜索公海内联系人",
            placeholder: "搜索公海内联系人",
            value: request.name,
            onSearch: setName,
          }}
          onClearAll={request.name ? () => setName("") : undefined}
        />
        <DataWorkspace
          errorMessage={
            contactsQuery.isError
              ? contactsQuery.error instanceof ApiError
                ? contactsQuery.error.message
                : "公海联系人暂时无法加载"
              : undefined
          }
          label="公海联系人数据工作区"
        >
          {claimMutation.isSuccess ? (
            <Typography.Text role="status" type="success">
              已领取 {claimMutation.variables?.length ?? 0} 位联系人。
            </Typography.Text>
          ) : null}
          {assignMutation.isSuccess ? (
            <Typography.Text role="status" type="success">
              已分配 {assignMutation.variables?.contacts.length ?? 0} 位联系人。
            </Typography.Text>
          ) : null}
          {deleteMutation.isSuccess ? (
            <Typography.Text role="status" type="success">
              已删除 {deleteMutation.variables?.length ?? 0} 位联系人。
            </Typography.Text>
          ) : null}
          {claimMutation.isError ? (
            <Alert
              title={
                claimMutation.error instanceof ApiError
                  ? claimMutation.error.message
                  : "联系人暂时无法领取"
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
                  : "联系人暂时无法删除"
              }
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            bulkActions={
              <Space>
                {canClaimContacts ? (
                  <Popconfirm
                    cancelText="取消"
                    okText="确认领取"
                    title={`确认领取已选 ${selectedContacts.length} 位联系人吗？`}
                    onConfirm={() => claimMutation.mutate(selectedContacts)}
                  >
                    <Button disabled={claimMutation.isPending || selectedContacts.length === 0}>
                      批量领取
                    </Button>
                  </Popconfirm>
                ) : null}
                {canAssignContacts && canReadOrganization ? (
                  <Button
                    disabled={assignMutation.isPending || selectedContacts.length === 0}
                    onClick={() => openAssignPicker(selectedContacts)}
                  >
                    批量分配
                  </Button>
                ) : null}
                {canDeleteContacts ? (
                  <Popconfirm
                    cancelText="取消"
                    description="删除后这些联系人会进入服务端软删除状态，且无法再从此公海领取或分配。"
                    okButtonProps={{ danger: true }}
                    okText="确认删除"
                    title={`确认删除已选 ${selectedContacts.length} 位联系人吗？`}
                    onConfirm={() => deleteMutation.mutate(selectedContacts)}
                  >
                    <Button
                      danger
                      disabled={deleteMutation.isPending || selectedContacts.length === 0}
                    >
                      批量删除
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            }
            columns={columns(
              canReadContactDetails,
              claimMutation.isPending,
              deleteMutation.isPending,
              pool.administrator,
              claimContact,
              (contact) => openAssignPicker([contact]),
              deleteContact,
            )}
            loading={contactsQuery.isLoading}
            page={page}
            rowKey={(contact) => contact.id}
            rowSelection={contactRowSelection}
            selectedRowCount={selectedContacts.length}
            renderMobileItem={(contact) => (
              <Card
                className={styles.mobileCard}
                size="small"
                title={
                  canReadContactDetails ? (
                    <Link to={`/crm/contacts/${contact.id}`}>{contact.name}</Link>
                  ) : (
                    contact.name
                  )
                }
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{contact.jobTitle ?? "未提供职务"}</Typography.Text>
                  <Typography.Text>{contact.phoneNumber ?? "未提供联系电话"}</Typography.Text>
                  <div className={styles.mobileMeta}>
                    {contact.status ? <Tag>{contact.status}</Tag> : null}
                    {contact.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                  <ClaimContactAction
                    contact={contact}
                    isPending={claimMutation.isPending}
                    onClaim={claimContact}
                  />
                  <AssignContactAction
                    contact={contact}
                    poolAdministrator={pool.administrator}
                    onAssign={(contact) => openAssignPicker([contact])}
                  />
                  <DeleteContactAction
                    contact={contact}
                    isPending={deleteMutation.isPending}
                    poolAdministrator={pool.administrator}
                    onDelete={deleteContact}
                  />
                </Space>
              </Card>
            )}
            onPageChange={setPage}
          />
        </DataWorkspace>
        <Modal
          destroyOnHidden
          footer={null}
          open={assignContacts.length > 0}
          title={assignContacts.length > 1 ? "批量分配联系人" : "分配联系人"}
          onCancel={closeAssignPicker}
        >
          <Typography.Paragraph type="secondary">
            {assignContacts.length === 0
              ? ""
              : assignContacts.length === 1
                ? `将联系人“${assignContacts[0]?.name ?? ""}”分配给一位服务端可见的在职成员。最终成员资格、公海管理员资格与并发版本均由服务端复核。`
                : `将已选 ${assignContacts.length} 位联系人分配给一位服务端可见的在职成员。最终成员资格、公海管理员资格与每条记录的并发版本均由服务端复核。`}
          </Typography.Paragraph>
          {canReadOrganization ? (
            <>
              <Input.Search
                allowClear
                defaultValue={assigneeKeyword}
                placeholder="按成员姓名搜索"
                onSearch={(keyword) => setAssigneeKeyword(keyword)}
              />
              {assigneeQuery.isError ? (
                <Alert
                  title="成员列表暂时无法加载"
                  showIcon
                  style={{ marginTop: 12 }}
                  type="error"
                />
              ) : (
                <List
                  dataSource={[...(assigneeQuery.data ?? [])]}
                  loading={assigneeQuery.isLoading}
                  locale={{ emptyText: "未找到可分配成员" }}
                  renderItem={(member) => (
                    <List.Item
                      actions={[
                        <Button
                          disabled={assignMutation.isPending || assignContacts.length === 0}
                          key={member.actorId}
                          loading={assignMutation.isPending}
                          type="link"
                          onClick={() => {
                            if (assignContacts.length > 0) {
                              assignMutation.mutate({
                                contacts: assignContacts,
                                ownerActorId: member.actorId,
                              });
                            }
                          }}
                        >
                          分配给此成员
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        description={`成员 ${member.actorId}`}
                        title={member.displayName}
                      />
                    </List.Item>
                  )}
                />
              )}
            </>
          ) : (
            <Alert
              title="当前没有成员目录读取权限，无法选择联系人分配对象。"
              showIcon
              type="warning"
            />
          )}
          {assignMutation.isError ? (
            <Alert
              title={
                assignMutation.error instanceof ApiError
                  ? assignMutation.error.message
                  : "联系人暂时无法分配"
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
        </Modal>
      </main>
    </RouteAuthority>
  );
}
