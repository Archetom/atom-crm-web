import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Tabs,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import type { ApiClient } from "~/api/client/api-client";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  normalizePageRequest,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";

import { oaKeys } from "../model/query-keys";

type OaAnnouncement = components["schemas"]["OaAnnouncementResponse"];
type OaAnnouncementSummary = components["schemas"]["OaAnnouncementSummaryResponse"];
type OaAnnouncementInbox = components["schemas"]["OaAnnouncementInboxResponse"];
type OaAudienceSelector = components["schemas"]["OaAnnouncementAudienceSelectorRequest"];
type AudienceCandidateType = Extract<OaAudienceSelector["type"], "MEMBER" | "DEPARTMENT_SUBTREE">;

interface AnnouncementDraft {
  body: string;
  departmentIds: string[];
  includeTenant: boolean;
  memberActorIds: string[];
  title: string;
}

interface ScheduleDraft {
  scheduledPublishTime: Dayjs;
}

type AnnouncementAction =
  | { announcement: OaAnnouncement; kind: "PUBLISH" | "CANCEL_SCHEDULE" | "WITHDRAW" | "DELETE" }
  | { announcement: OaAnnouncement; kind: "SCHEDULE"; scheduledPublishTime: string };

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function nextCandidatePage({
  pageNum,
  pageSize: resultPageSize,
  totalNum,
}: {
  pageNum: number;
  pageSize: number;
  totalNum: number;
}): number | undefined {
  return pageNum * resultPageSize < totalNum ? pageNum + 1 : undefined;
}

function toPageResult<T>(response: {
  objectList: T[];
  pageNum: number;
  pageSize: number;
  totalNum: number;
}): PageResult<T> {
  return {
    page: response.pageNum,
    size: response.pageSize,
    total: response.totalNum,
    items: response.objectList,
    meta: {},
  };
}

function readPage(search: URLSearchParams, prefix: string) {
  return normalizePageRequest({
    page: Number.parseInt(search.get(`${prefix}Page`) ?? "", 10),
    size: Number.parseInt(search.get(`${prefix}Size`) ?? "", 10),
  });
}

function writePage(
  current: URLSearchParams,
  prefix: string,
  page: number,
  size: number,
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set(`${prefix}Page`, String(page));
  next.set(`${prefix}Size`, String(size));
  return next;
}

function formatTime(value: string | undefined): string {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "—";
}

function audienceRequest(draft: AnnouncementDraft): OaAudienceSelector[] {
  const audience: OaAudienceSelector[] = [];
  if (draft.includeTenant) audience.push({ type: "TENANT" });
  for (const departmentId of draft.departmentIds) {
    const numericId = Number(departmentId);
    if (Number.isSafeInteger(numericId) && numericId > 0) {
      audience.push({ departmentId: numericId, type: "DEPARTMENT_SUBTREE" });
    }
  }
  for (const memberActorId of draft.memberActorIds) {
    const numericId = Number(memberActorId);
    if (Number.isSafeInteger(numericId) && numericId > 0) {
      audience.push({ memberActorId: numericId, type: "MEMBER" });
    }
  }
  if (audience.length === 0) throw new Error("请至少选择一个服务端允许的公告受众。");
  return audience;
}

function toCreateRequest(
  draft: AnnouncementDraft,
): components["schemas"]["OaAnnouncementCreateRequest"] {
  return {
    title: draft.title.trim(),
    body: draft.body.trim(),
    audience: audienceRequest(draft),
  };
}

function toUpdateRequest(
  draft: AnnouncementDraft,
  version: number,
): components["schemas"]["OaAnnouncementUpdateRequest"] {
  return { ...toCreateRequest(draft), version };
}

function sourceCandidateOptions(
  source: OaAnnouncement | null,
  type: AudienceCandidateType,
): { label: string; value: string }[] {
  if (source === null) return [];
  return source.audience.flatMap((selector) => {
    const id = type === "MEMBER" ? selector.memberActorId : selector.departmentId;
    return selector.type === type && typeof id === "number" && selector.displayName
      ? [{ label: selector.displayName, value: String(id) }]
      : [];
  });
}

function audienceInitialValues(source: OaAnnouncement | null): AnnouncementDraft {
  return {
    title: source?.title ?? "",
    body: source?.body ?? "",
    includeTenant: source?.audience.some((selector) => selector.type === "TENANT") ?? false,
    departmentIds:
      source?.audience.flatMap((selector) =>
        selector.type === "DEPARTMENT_SUBTREE" && typeof selector.departmentId === "number"
          ? [String(selector.departmentId)]
          : [],
      ) ?? [],
    memberActorIds:
      source?.audience.flatMap((selector) =>
        selector.type === "MEMBER" && typeof selector.memberActorId === "number"
          ? [String(selector.memberActorId)]
          : [],
      ) ?? [],
  };
}

function audienceLabels(source: OaAnnouncement): string[] {
  return source.audience.map((selector) => {
    if (selector.type === "TENANT") return "全体成员";
    return selector.displayName ?? "受众信息暂不可用";
  });
}

function canEditAudience(source: OaAnnouncement): boolean {
  return source.audience.every((selector) => {
    if (selector.type === "TENANT") return true;
    const id = selector.type === "MEMBER" ? selector.memberActorId : selector.departmentId;
    return typeof id === "number" && Boolean(selector.displayName);
  });
}

function AudienceCandidateSelect({
  apiClient,
  identityKey,
  initialOptions,
  label,
  name,
  type,
}: Readonly<{
  apiClient: ApiClient;
  identityKey: string;
  initialOptions: { label: string; value: string }[];
  label: string;
  name: "departmentIds" | "memberActorIds";
  type: AudienceCandidateType;
}>) {
  const [keyword, setKeyword] = useState("");
  const candidatesQuery = useInfiniteQuery({
    queryKey: oaKeys.announcementAudienceCandidates(identityKey, type, keyword),
    queryFn: ({ pageParam }) =>
      apiClient.getOaAnnouncementAudienceCandidates({
        type,
        keyword: keyword || undefined,
        page: pageParam,
        size: 50,
      }),
    getNextPageParam: nextCandidatePage,
    initialPageParam: 1,
  });
  const options = Array.from(
    new Map(
      [
        ...initialOptions,
        ...(candidatesQuery.data?.pages.flatMap((page) =>
          page.objectList.map((candidate) => ({
            label: candidate.displayName,
            value: String(candidate.id),
          })),
        ) ?? []),
      ].map((option) => [option.value, option]),
    ).values(),
  );

  return (
    <Form.Item label={label} name={name}>
      <Select
        allowClear
        filterOption={false}
        loading={candidatesQuery.isLoading || candidatesQuery.isFetchingNextPage}
        mode="multiple"
        onPopupScroll={(event) => {
          const target = event.currentTarget;
          if (
            target.scrollTop + target.clientHeight >= target.scrollHeight - 24 &&
            candidatesQuery.hasNextPage
          ) {
            void candidatesQuery.fetchNextPage();
          }
        }}
        onSearch={setKeyword}
        options={options}
        placeholder="输入关键词搜索服务端允许的受众"
        showSearch
      />
    </Form.Item>
  );
}

function AnnouncementEditor({
  apiClient,
  error,
  form,
  identityKey,
  onCancel,
  onSubmit,
  open,
  source,
  submitting,
}: Readonly<{
  apiClient: ApiClient;
  error: unknown;
  form: ReturnType<typeof Form.useForm<AnnouncementDraft>>[0];
  identityKey: string;
  onCancel: () => void;
  onSubmit: (draft: AnnouncementDraft) => void;
  open: boolean;
  source: OaAnnouncement | null;
  submitting: boolean;
}>) {
  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ loading: submitting }}
      okText={source === null ? "创建草稿" : "保存"}
      onCancel={onCancel}
      onOk={() => form.submit()}
      open={open}
      title={source === null ? "新建内部公告" : "编辑内部公告"}
    >
      {error ? <Alert title={messageFor(error, "公告暂时无法保存")} showIcon type="error" /> : null}
      <Form<AnnouncementDraft> form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item
          label="标题"
          name="title"
          rules={[{ required: true, message: "请输入公告标题" }]}
        >
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item label="正文" name="body" rules={[{ required: true, message: "请输入公告正文" }]}>
          <Input.TextArea maxLength={20_000} rows={8} />
        </Form.Item>
        <Form.Item name="includeTenant" valuePropName="checked">
          <Checkbox>发送给全体成员</Checkbox>
        </Form.Item>
        <AudienceCandidateSelect
          apiClient={apiClient}
          identityKey={identityKey}
          initialOptions={sourceCandidateOptions(source, "DEPARTMENT_SUBTREE")}
          label="部门及下属部门"
          name="departmentIds"
          type="DEPARTMENT_SUBTREE"
        />
        <AudienceCandidateSelect
          apiClient={apiClient}
          identityKey={identityKey}
          initialOptions={sourceCandidateOptions(source, "MEMBER")}
          label="指定成员"
          name="memberActorIds"
          type="MEMBER"
        />
        <Typography.Paragraph type="secondary">
          成员和部门只能从当前操作者可用的服务端受众目录选择。发布、定时、撤回和删除能力均由对应公告详情的服务端
          capability 决定。
        </Typography.Paragraph>
      </Form>
    </Modal>
  );
}

export function OaAnnouncementsPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editorSource, setEditorSource] = useState<OaAnnouncement | null | undefined>(undefined);
  const [managedSelected, setManagedSelected] = useState<OaAnnouncementSummary | null>(null);
  const [inboxSelected, setInboxSelected] = useState<OaAnnouncementInbox | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [announcementForm] = Form.useForm<AnnouncementDraft>();
  const [scheduleForm] = Form.useForm<ScheduleDraft>();
  const identityKey = authState?.identityKey ?? "pending";
  const canWrite = hasAuthority(authorization, authority.oaAnnouncementsWrite);
  const activeTab = searchParams.get("tab") === "manage" && canWrite ? "manage" : "inbox";
  const inboxPage = useMemo(() => readPage(searchParams, "inbox"), [searchParams]);
  const managePage = useMemo(() => readPage(searchParams, "manage"), [searchParams]);
  const inboxQuery = useQuery({
    queryKey: oaKeys.inbox(identityKey, inboxPage.page, inboxPage.size),
    queryFn: () =>
      apiClient?.getMyOaAnnouncements(inboxPage) ??
      Promise.reject(new Error("公告收件箱暂时不可用。")),
    enabled: apiClient !== null,
  });
  const unreadQuery = useQuery({
    queryKey: oaKeys.inboxUnreadCount(identityKey),
    queryFn: () =>
      apiClient?.getMyOaAnnouncementUnreadCount() ??
      Promise.reject(new Error("公告未读数暂时不可用。")),
    enabled: apiClient !== null,
  });
  const inboxDetailQuery = useQuery({
    queryKey: oaKeys.inboxAnnouncement(identityKey, inboxSelected?.id ?? 0),
    queryFn: () => {
      if (apiClient === null || inboxSelected === null) {
        return Promise.reject(new Error("公告详情暂时不可用。"));
      }
      return apiClient.getMyOaAnnouncement(inboxSelected.id);
    },
    enabled: apiClient !== null && inboxSelected !== null,
  });
  const managedQuery = useQuery({
    queryKey: oaKeys.announcements(identityKey, managePage.page, managePage.size),
    queryFn: () =>
      apiClient?.getOaAnnouncements(managePage) ??
      Promise.reject(new Error("公告管理暂时不可用。")),
    enabled: apiClient !== null && canWrite,
  });
  const managedDetailQuery = useQuery({
    queryKey: oaKeys.announcement(identityKey, managedSelected?.id ?? 0),
    queryFn: () => {
      if (apiClient === null || managedSelected === null) {
        return Promise.reject(new Error("公告详情暂时不可用。"));
      }
      return apiClient.getOaAnnouncement(managedSelected.id);
    },
    enabled: apiClient !== null && canWrite && managedSelected !== null,
  });
  const saveMutation = useMutation({
    mutationFn: ({
      draft,
      source,
    }: {
      draft: AnnouncementDraft;
      source: OaAnnouncement | null;
    }) => {
      if (apiClient === null) return Promise.reject(new Error("公告暂时无法保存。"));
      return source === null
        ? apiClient.createOaAnnouncement(toCreateRequest(draft))
        : apiClient.updateOaAnnouncement(source.id, toUpdateRequest(draft, source.version));
    },
    onSuccess: () => {
      setEditorSource(undefined);
      void queryClient.invalidateQueries({ queryKey: oaKeys.all });
    },
  });
  const actionMutation = useMutation({
    mutationFn: (action: AnnouncementAction) => {
      if (apiClient === null) return Promise.reject(new Error("公告操作暂时不可用。"));
      switch (action.kind) {
        case "PUBLISH":
          return apiClient.publishOaAnnouncement(action.announcement.id, {
            version: action.announcement.version,
          });
        case "SCHEDULE":
          return apiClient.scheduleOaAnnouncement(action.announcement.id, {
            version: action.announcement.version,
            scheduledPublishTime: action.scheduledPublishTime,
          });
        case "CANCEL_SCHEDULE":
          return apiClient.cancelOaAnnouncementSchedule(action.announcement.id, {
            version: action.announcement.version,
          });
        case "WITHDRAW":
          return apiClient.withdrawOaAnnouncement(action.announcement.id, {
            version: action.announcement.version,
          });
        case "DELETE":
          return apiClient.deleteOaAnnouncement(
            action.announcement.id,
            action.announcement.version,
          );
      }
    },
    onSuccess: (_, action) => {
      if (action.kind === "DELETE") setManagedSelected(null);
      setScheduleOpen(false);
      void queryClient.invalidateQueries({ queryKey: oaKeys.all });
    },
  });
  const readMutation = useMutation({
    mutationFn: async (announcementId: number) => {
      if (apiClient === null) throw new Error("公告状态暂时无法更新。 ");
      const receipt = await apiClient.markMyOaAnnouncementRead(announcementId);
      if (receipt.announcementId !== announcementId) {
        throw new Error("公告已读状态暂时无法确认。");
      }
      return receipt;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oaKeys.all });
    },
  });
  const inboxPageResult: PageResult<OaAnnouncementInbox> = inboxQuery.data
    ? toPageResult(inboxQuery.data)
    : { ...defaultPageRequest, items: [], meta: {}, total: null };
  const managedPageResult: PageResult<OaAnnouncementSummary> = managedQuery.data
    ? toPageResult(managedQuery.data)
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  function openEditor(source: OaAnnouncement | null) {
    announcementForm.setFieldsValue(audienceInitialValues(source));
    setEditorSource(source);
  }

  function changeTab(tab: string) {
    const next = new URLSearchParams(searchParams);
    if (tab === "manage" && canWrite) next.set("tab", "manage");
    else next.delete("tab");
    setSearchParams(next);
  }

  const inboxColumns: ColumnsType<OaAnnouncementInbox> = [
    { dataIndex: "title", key: "title", title: "标题" },
    {
      dataIndex: "publishedTime",
      key: "publishedTime",
      title: "发布时间",
      render: (value) => formatTime(value),
    },
    {
      dataIndex: "read",
      key: "read",
      title: "状态",
      render: (read) => <Tag color={read ? "default" : "blue"}>{read ? "已读" : "未读"}</Tag>,
    },
    {
      key: "actions",
      title: "操作",
      render: (_, item) => <Button onClick={() => setInboxSelected(item)}>查看</Button>,
    },
  ];
  const managedColumns: ColumnsType<OaAnnouncementSummary> = [
    { dataIndex: "title", key: "title", title: "标题" },
    {
      dataIndex: "status",
      key: "status",
      title: "状态",
      render: (value) => <Tag>{value}</Tag>,
    },
    {
      key: "readRate",
      title: "阅读情况",
      render: (_, item) => `${item.readTotal}/${item.recipientTotal}`,
    },
    {
      dataIndex: "updatedTime",
      key: "updatedTime",
      title: "更新时间",
      render: (value) => formatTime(value),
    },
    {
      key: "actions",
      title: "操作",
      render: (_, item) => <Button onClick={() => setManagedSelected(item)}>查看详情</Button>,
    },
  ];
  const managedDetail = managedDetailQuery.data;

  return (
    <RouteAuthority authority={authority.oaAnnouncementsRead}>
      <main>
        <Typography.Title level={2}>内部公告</Typography.Title>
        <Typography.Paragraph type="secondary">
          收件箱只显示服务端投递给当前成员的公告；具有公告写入权限时，可从同一服务端受众目录创建、发布和管理公告。
        </Typography.Paragraph>
        <Tabs activeKey={activeTab} onChange={changeTab}>
          <Tabs.TabPane
            key="inbox"
            tab={`我的收件箱${unreadQuery.data?.unreadCount ? `（${unreadQuery.data.unreadCount} 未读）` : ""}`}
          >
            {inboxQuery.isError ? (
              <Alert
                title={messageFor(inboxQuery.error, "公告收件箱暂时无法加载")}
                showIcon
                type="error"
              />
            ) : null}
            <ResponsiveDataList
              columns={inboxColumns}
              loading={inboxQuery.isLoading}
              onPageChange={(page, size) =>
                setSearchParams(writePage(searchParams, "inbox", page, size))
              }
              page={inboxPageResult}
              renderMobileItem={(item) => (
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text strong>{item.title}</Typography.Text>
                  <Typography.Text type="secondary">
                    {formatTime(item.publishedTime)}
                  </Typography.Text>
                  <Tag color={item.read ? "default" : "blue"}>{item.read ? "已读" : "未读"}</Tag>
                  <Button onClick={() => setInboxSelected(item)} size="small">
                    查看
                  </Button>
                </Space>
              )}
              rowKey={(item) => item.id}
            />
          </Tabs.TabPane>
          {canWrite ? (
            <Tabs.TabPane key="manage" tab="公告管理">
              <ActionAuthority authority={authority.oaAnnouncementsWrite}>
                <Button onClick={() => openEditor(null)} type="primary">
                  新建公告
                </Button>
              </ActionAuthority>
              {managedQuery.isError ? (
                <Alert
                  title={messageFor(managedQuery.error, "公告管理暂时无法加载")}
                  showIcon
                  style={{ marginTop: 16 }}
                  type="error"
                />
              ) : null}
              <ResponsiveDataList
                columns={managedColumns}
                loading={managedQuery.isLoading}
                onPageChange={(page, size) =>
                  setSearchParams(writePage(searchParams, "manage", page, size))
                }
                page={managedPageResult}
                renderMobileItem={(item) => (
                  <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                    <Typography.Text strong>{item.title}</Typography.Text>
                    <Tag>{item.status}</Tag>
                    <Typography.Text type="secondary">
                      阅读 {item.readTotal}/{item.recipientTotal}
                    </Typography.Text>
                    <Button onClick={() => setManagedSelected(item)} size="small">
                      查看详情
                    </Button>
                  </Space>
                )}
                rowKey={(item) => item.id}
              />
            </Tabs.TabPane>
          ) : null}
        </Tabs>
      </main>
      <Drawer
        destroyOnHidden
        onClose={() => setInboxSelected(null)}
        open={inboxSelected !== null}
        title="公告详情"
        width={560}
      >
        {inboxDetailQuery.isLoading ? <Spin /> : null}
        {inboxDetailQuery.isError ? (
          <Alert
            title={messageFor(inboxDetailQuery.error, "公告详情暂时无法加载")}
            showIcon
            type="error"
          />
        ) : null}
        {inboxDetailQuery.data ? (
          <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
            <Typography.Title level={4}>{inboxDetailQuery.data.title}</Typography.Title>
            <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
              {inboxDetailQuery.data.body}
            </Typography.Paragraph>
            <Typography.Text type="secondary">
              发布时间：{formatTime(inboxDetailQuery.data.publishedTime)}
            </Typography.Text>
            {inboxDetailQuery.data.read ? (
              <Tag>已读</Tag>
            ) : (
              <Button
                loading={readMutation.isPending}
                onClick={() => readMutation.mutate(inboxDetailQuery.data.id)}
              >
                标为已读
              </Button>
            )}
            {readMutation.isError ? (
              <Alert
                title={messageFor(readMutation.error, "公告状态暂时无法更新")}
                showIcon
                type="error"
              />
            ) : null}
          </Space>
        ) : null}
      </Drawer>
      <Drawer
        destroyOnHidden
        onClose={() => setManagedSelected(null)}
        open={managedSelected !== null}
        title="公告管理详情"
        width={640}
      >
        {managedDetailQuery.isLoading ? <Spin /> : null}
        {managedDetailQuery.isError ? (
          <Alert
            title={messageFor(managedDetailQuery.error, "公告详情暂时无法加载")}
            showIcon
            type="error"
          />
        ) : null}
        {managedDetail ? (
          <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
            <Typography.Title level={4}>{managedDetail.title}</Typography.Title>
            <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
              {managedDetail.body}
            </Typography.Paragraph>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="状态">
                <Tag>{managedDetail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="受众">
                {audienceLabels(managedDetail).join("、")}
              </Descriptions.Item>
              <Descriptions.Item label="阅读情况">
                {managedDetail.readTotal}/{managedDetail.recipientTotal}
              </Descriptions.Item>
              <Descriptions.Item label="定时发布时间">
                {formatTime(managedDetail.scheduledPublishTime)}
              </Descriptions.Item>
              <Descriptions.Item label="发布时间">
                {formatTime(managedDetail.publishedTime)}
              </Descriptions.Item>
            </Descriptions>
            <ActionAuthority authority={authority.oaAnnouncementsWrite}>
              <Space wrap>
                {managedDetail.allowedActions.includes("UPDATE") ? (
                  <Button
                    disabled={!canEditAudience(managedDetail)}
                    onClick={() => openEditor(managedDetail)}
                  >
                    编辑
                  </Button>
                ) : null}
                {managedDetail.allowedActions.includes("PUBLISH") ? (
                  <Popconfirm
                    cancelText="取消"
                    description="服务端会重新校验当前受众、状态与版本。"
                    okText="发布"
                    onConfirm={() =>
                      actionMutation.mutate({ announcement: managedDetail, kind: "PUBLISH" })
                    }
                    title="确认立即发布此公告？"
                  >
                    <Button loading={actionMutation.isPending}>立即发布</Button>
                  </Popconfirm>
                ) : null}
                {managedDetail.allowedActions.includes("SCHEDULE") ? (
                  <Button
                    onClick={() => {
                      scheduleForm.resetFields();
                      setScheduleOpen(true);
                    }}
                  >
                    定时发布
                  </Button>
                ) : null}
                {managedDetail.allowedActions.includes("CANCEL_SCHEDULE") ? (
                  <Popconfirm
                    cancelText="取消"
                    okText="取消定时"
                    onConfirm={() =>
                      actionMutation.mutate({
                        announcement: managedDetail,
                        kind: "CANCEL_SCHEDULE",
                      })
                    }
                    title="确认取消定时发布？"
                  >
                    <Button loading={actionMutation.isPending}>取消定时</Button>
                  </Popconfirm>
                ) : null}
                {managedDetail.allowedActions.includes("WITHDRAW") ? (
                  <Popconfirm
                    cancelText="取消"
                    okText="撤回"
                    onConfirm={() =>
                      actionMutation.mutate({ announcement: managedDetail, kind: "WITHDRAW" })
                    }
                    title="确认撤回已发布公告？"
                  >
                    <Button loading={actionMutation.isPending}>撤回</Button>
                  </Popconfirm>
                ) : null}
                {managedDetail.allowedActions.includes("DELETE") ? (
                  <Popconfirm
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    okText="删除"
                    onConfirm={() =>
                      actionMutation.mutate({ announcement: managedDetail, kind: "DELETE" })
                    }
                    title="确认删除此公告？"
                  >
                    <Button danger loading={actionMutation.isPending}>
                      删除
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            </ActionAuthority>
            {managedDetail.allowedActions.includes("UPDATE") && !canEditAudience(managedDetail) ? (
              <Alert
                title="公告受众中存在不可用的目录项，不能安全地完整回写；请在服务端处理该受众后再编辑。"
                showIcon
                type="warning"
              />
            ) : null}
            {actionMutation.isError ? (
              <Alert
                title={messageFor(actionMutation.error, "公告操作暂时无法完成")}
                showIcon
                type="error"
              />
            ) : null}
          </Space>
        ) : null}
      </Drawer>
      {apiClient && editorSource !== undefined ? (
        <AnnouncementEditor
          apiClient={apiClient}
          error={saveMutation.error}
          form={announcementForm}
          identityKey={identityKey}
          onCancel={() => setEditorSource(undefined)}
          onSubmit={(draft) => saveMutation.mutate({ draft, source: editorSource })}
          open
          source={editorSource}
          submitting={saveMutation.isPending}
        />
      ) : null}
      <Modal
        destroyOnHidden
        okButtonProps={{ loading: actionMutation.isPending }}
        okText="确认定时"
        onCancel={() => {
          scheduleForm.resetFields();
          setScheduleOpen(false);
        }}
        onOk={() => scheduleForm.submit()}
        open={scheduleOpen && managedDetail !== undefined}
        title="定时发布"
      >
        <Form<ScheduleDraft>
          form={scheduleForm}
          layout="vertical"
          onFinish={(draft) => {
            if (managedDetail) {
              actionMutation.mutate({
                announcement: managedDetail,
                kind: "SCHEDULE",
                scheduledPublishTime: draft.scheduledPublishTime.toISOString(),
              });
            }
          }}
        >
          <Form.Item
            label="发布时间"
            name="scheduledPublishTime"
            rules={[{ required: true, message: "请选择发布时间" }]}
          >
            <DatePicker
              disabledDate={(date) => date.isBefore(dayjs(), "minute")}
              showTime
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Typography.Paragraph type="secondary">
            浏览器仅提交所选时间和当前服务端 version；公告状态、时区、时间有效性和并发由服务端复核。
          </Typography.Paragraph>
        </Form>
      </Modal>
    </RouteAuthority>
  );
}
