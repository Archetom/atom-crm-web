import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, DatePicker, Empty, List, Modal, Space, Tag, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";

import { worklistKeys } from "../model/query-keys";
import { type WorklistItem, type WorklistKind } from "../model/worklist-page";

import styles from "./worklist-page.module.css";

const worklistPageSize = 50;

const kindLabels: Record<WorklistKind, string> = {
  APPROVAL_PENDING: "审批待办",
  CONTACT_FOLLOW_UP: "联系人跟进",
  CONTRACT_EXPIRY: "合同到期",
  FOLLOW_UP: "跟进提醒",
  LEAD_FOLLOW_UP: "线索跟进",
  OPPORTUNITY_FOLLOW_UP: "商机跟进",
  RECEIVABLE_PLAN_REMINDER: "回款计划提醒",
  RETURN_VISIT: "回访",
  WORK_TASK: "Work 任务",
};

function today(): string {
  return dayjs().format("YYYY-MM-DD");
}

function parseDate(value: string | null): string {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return today();

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    year >= 1000
    ? value
    : today();
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function WorklistPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmKind, setConfirmKind] = useState<WorklistKind | null>(null);
  const date = useMemo(() => parseDate(searchParams.get("date")), [searchParams]);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadWorklist = hasAuthority(authorization, authority.worklistRead);
  const worklistQuery = useInfiniteQuery({
    queryKey: worklistKeys.day(identityKey, date),
    queryFn: ({ pageParam }) =>
      apiClient === null
        ? Promise.reject(new Error("工作台待办暂时不可用。"))
        : apiClient.getWorklist({
            cursor: pageParam ?? undefined,
            date,
            size: worklistPageSize,
          }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: apiClient !== null && canReadWorklist,
  });
  const acknowledgeMutation = useMutation({
    mutationFn: (request: Parameters<NonNullable<typeof apiClient>["acknowledgeWorklist"]>[0]) =>
      apiClient === null
        ? Promise.reject(new Error("工作台待办确认暂时不可用。"))
        : apiClient.acknowledgeWorklist(request),
    onSuccess: (_, request) => {
      void queryClient.invalidateQueries({ queryKey: worklistKeys.day(identityKey, request.date) });
      setConfirmKind(null);
    },
  });
  const items = worklistQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const visibleKinds = [...new Set(items.map((item) => item.kind))];

  function updateDate(next: Dayjs | null) {
    if (next === null) return;
    const value = next.format("YYYY-MM-DD");
    const params = new URLSearchParams(searchParams);
    if (value === today()) params.delete("date");
    else params.set("date", value);
    setSearchParams(params);
  }

  function acknowledgeItem(item: WorklistItem) {
    acknowledgeMutation.mutate({
      date,
      items: [
        {
          dueTime: item.dueTime,
          kind: item.kind,
          sourceId: item.sourceId,
          sourceVersion: item.sourceVersion,
        },
      ],
    });
  }

  function acknowledgeKind() {
    if (confirmKind === null) return;
    acknowledgeMutation.mutate({ date, kind: confirmKind });
  }

  return (
    <RouteAuthority authority={authority.worklistRead}>
      <main className={styles.page}>
        <section className={styles.heading}>
          <div>
            <Typography.Title level={2}>我的待办</Typography.Title>
            <Typography.Text type="secondary">
              仅显示服务端按当前日期、权限和数据范围返回的事项摘要与到期时间。确认只隐藏当前成员的待办投影，不修改原业务记录。
            </Typography.Text>
          </div>
          <Space className={styles.dateActions} wrap>
            <DatePicker
              allowClear={false}
              aria-label="待办日期"
              value={dayjs(date)}
              onChange={updateDate}
            />
            {date !== today() ? (
              <Button onClick={() => updateDate(dayjs())}>回到今天</Button>
            ) : null}
          </Space>
        </section>

        {worklistQuery.isError ? (
          <Alert
            title={errorMessage(worklistQuery.error, "工作台待办暂时无法加载")}
            showIcon
            type="error"
          />
        ) : null}
        {acknowledgeMutation.isError ? (
          <Alert
            title={errorMessage(acknowledgeMutation.error, "待办确认暂时无法完成")}
            showIcon
            type="error"
          />
        ) : null}

        <Card className={styles.listCard} title="当日待办">
          {visibleKinds.length > 0 ? (
            <Space className={styles.categoryActions} wrap>
              {visibleKinds.map((kind) => (
                <Button key={kind} onClick={() => setConfirmKind(kind)}>
                  确认全部{kindLabels[kind]}
                </Button>
              ))}
            </Space>
          ) : null}
          <List
            dataSource={items}
            loading={worklistQuery.isLoading}
            locale={{
              emptyText: <Empty description="当天暂无待办" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="acknowledge"
                    loading={acknowledgeMutation.isPending}
                    onClick={() => acknowledgeItem(item)}
                  >
                    确认
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  description={dayjs(item.dueTime).format("YYYY-MM-DD HH:mm")}
                  title={
                    <Space wrap>
                      <Tag>{kindLabels[item.kind]}</Tag>
                      <Typography.Text>{item.summary}</Typography.Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
          {worklistQuery.hasNextPage ? (
            <div className={styles.loadMore}>
              <Button
                loading={worklistQuery.isFetchingNextPage}
                onClick={() => worklistQuery.fetchNextPage()}
              >
                加载更多
              </Button>
            </div>
          ) : null}
        </Card>
      </main>
      <Modal
        destroyOnHidden
        okButtonProps={{ danger: true, loading: acknowledgeMutation.isPending }}
        okText="确认全部"
        open={confirmKind !== null}
        title={confirmKind === null ? "确认待办" : `确认全部${kindLabels[confirmKind]}`}
        onCancel={() => {
          if (!acknowledgeMutation.isPending) setConfirmKind(null);
        }}
        onOk={acknowledgeKind}
      >
        <Typography.Paragraph>
          将确认当前日期、当前类别下服务端仍可见的全部待办。此操作不会修改客户、任务、审批或其他业务记录。
        </Typography.Paragraph>
      </Modal>
    </RouteAuthority>
  );
}
