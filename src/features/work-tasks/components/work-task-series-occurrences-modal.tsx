import { useQuery } from "@tanstack/react-query";
import { Alert, List, Modal, Pagination, Space, Spin, Typography } from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import {
  defaultPageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";

import { workTaskSeriesOccurrenceKeys } from "../model/series-occurrence-query-keys";
import {
  toWorkTaskSeriesOccurrence,
  type WorkTaskSeriesOccurrence,
  type WorkTaskSeriesOccurrenceStatus,
} from "../model/work-task-series-occurrence";

interface WorkTaskSeriesOccurrencesModalProps {
  seriesId: number;
  open: boolean;
  onClose: () => void;
}

const occurrencePageSize = 20;

const statusLabels: Readonly<Record<WorkTaskSeriesOccurrenceStatus, string>> = {
  MATERIALIZED: "已生成",
  SKIPPED: "已跳过",
};

function displayDueTime(value: string): string {
  return value.replace("T", " ");
}

/**
 * Shows immutable occurrence facts only. It never follows a generated task ID
 * or exposes the occurrence's generation, timezone, reason, or timestamps.
 */
export function WorkTaskSeriesOccurrencesModal({
  seriesId,
  open,
  onClose,
}: Readonly<WorkTaskSeriesOccurrencesModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadWorkTasks = hasAuthority(authorization, authority.workTasksRead);
  const occurrenceQuery = useQuery({
    queryKey: workTaskSeriesOccurrenceKeys.list(identityKey, {
      page: currentPage,
      seriesId,
      size: occurrencePageSize,
    }),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("周期任务实例暂时不可用。"))
        : apiClient.getWorkTaskSeriesOccurrences(seriesId, {
            page: currentPage,
            size: occurrencePageSize,
          }),
    enabled: apiClient !== null && open && canReadWorkTasks,
  });
  const occurrencePage: PageResult<WorkTaskSeriesOccurrence> = occurrenceQuery.data
    ? toPageResult(occurrenceQuery.data, (value) => toWorkTaskSeriesOccurrence(value, seriesId))
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  return (
    <Modal destroyOnHidden footer={null} open={open} title="周期实例" onCancel={onClose}>
      <Typography.Paragraph type="secondary">
        仅显示服务端确认当前成员可见系列的发生序号、实际到期时间和已生成/已跳过结果。不会读取或展示生成任务、成员、时区、生成批次、跳过原因或记录时间。
      </Typography.Paragraph>
      {occurrenceQuery.isLoading ? <Spin /> : null}
      {occurrenceQuery.isError ? (
        <Alert
          title={
            occurrenceQuery.error instanceof ApiError
              ? occurrenceQuery.error.message
              : "周期任务实例暂时无法加载"
          }
          showIcon
          type="error"
        />
      ) : null}
      <List<WorkTaskSeriesOccurrence>
        dataSource={occurrencePage.items}
        loading={occurrenceQuery.isFetching && !occurrenceQuery.isLoading}
        locale={{ emptyText: occurrenceQuery.isLoading ? "" : "暂无周期实例" }}
        renderItem={(occurrence) => (
          <List.Item>
            <List.Item.Meta
              description={`${displayDueTime(occurrence.resolvedDueTime)} · ${statusLabels[occurrence.status]}`}
              title={`第 ${occurrence.occurrenceSequence} 次发生`}
            />
          </List.Item>
        )}
      />
      {occurrencePage.total !== null && occurrencePage.total > occurrencePageSize ? (
        <Space style={{ marginTop: 12 }}>
          <Pagination
            current={currentPage}
            pageSize={occurrencePageSize}
            showSizeChanger={false}
            total={occurrencePage.total}
            onChange={(page) => setCurrentPage(page)}
          />
        </Space>
      ) : null}
    </Modal>
  );
}
