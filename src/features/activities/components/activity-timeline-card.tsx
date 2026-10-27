import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  List,
  Modal,
  Select,
  Spin,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict } from "~/api/errors/mutation-conflict";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { toPageResult } from "~/components/data-view/pagination";
import {
  MutationConflictNotice,
  type MutationConflictResolution,
} from "~/components/feedback/mutation-conflict-notice";

import { type ActivitySubjectType, toActivityTimelineItem } from "../model/activity-timeline";
import { activityKeys } from "../model/query-keys";

const timelinePageSize = 20;

interface ActivityEditDraft {
  category?: string;
  purpose?: string;
  content?: string;
  occurredTime?: Dayjs | null;
  nextContactTime?: Dayjs | null;
}

function mutationErrorMessage(error: unknown, fallback: string): string | null {
  if (error == null || getMutationConflict(error) !== null) return null;
  return error instanceof ApiError ? error.message : fallback;
}

export function ActivityTimelineCard({
  subjectId,
  subjectType,
}: Readonly<{
  subjectId: number;
  subjectType: ActivitySubjectType;
}>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const [composerOpen, setComposerOpen] = useState(false);
  const [category, setCategory] = useState<string>();
  const [purpose, setPurpose] = useState("");
  const [content, setContent] = useState("");
  const [occurredTime, setOccurredTime] = useState<Dayjs | null>(null);
  const [nextContactTime, setNextContactTime] = useState<Dayjs | null>(null);
  const [editActivityId, setEditActivityId] = useState<number | null>(null);
  const [deleteActivityId, setDeleteActivityId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ActivityEditDraft | null>(null);
  const canReadActivities = hasAuthority(authorization, authority.activitiesRead);
  const canWriteActivities = hasAuthority(authorization, authority.activitiesWrite);
  const canCompose = canReadActivities && canWriteActivities;
  const selectedActivityId = editActivityId ?? deleteActivityId;
  const timelineQuery = useQuery({
    queryKey: activityKeys.timeline(identityKey, subjectType, subjectId),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Activity timeline is unavailable."))
        : apiClient.getActivities({
            page: 1,
            size: timelinePageSize,
            subjectId,
            subjectType,
          }),
    enabled: apiClient !== null && canReadActivities,
  });
  const methodQuery = useQuery({
    queryKey: ["activity-method-options", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Activity method options are unavailable."))
        : apiClient.getActivityMethods(),
    enabled: apiClient !== null && (composerOpen || editActivityId !== null) && canCompose,
  });
  const activityDetailQuery = useQuery({
    queryKey: activityKeys.detail(identityKey, selectedActivityId ?? 0),
    queryFn: () =>
      apiClient === null || selectedActivityId === null
        ? Promise.reject(new Error("Activity detail is unavailable."))
        : apiClient.getActivity(selectedActivityId),
    enabled: apiClient !== null && selectedActivityId !== null && canCompose,
  });
  const createMutation = useMutation({
    mutationFn: () => {
      const selectedMethod = methodQuery.data?.find((option) => option.value === category);
      if (
        apiClient === null ||
        selectedMethod === undefined ||
        content.trim().length === 0 ||
        occurredTime === null
      ) {
        return Promise.reject(new Error("Activity create is unavailable."));
      }

      return apiClient.createActivity({
        category: selectedMethod.value,
        content: content.trim(),
        occurredTime: occurredTime.format("YYYY-MM-DDTHH:mm:ss"),
        ...(nextContactTime === null
          ? {}
          : { nextContactTime: nextContactTime.format("YYYY-MM-DDTHH:mm:ss") }),
        ...(purpose.trim().length === 0 ? {} : { purpose: purpose.trim() }),
        subjectId,
        subjectType,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: activityKeys.timeline(identityKey, subjectType, subjectId),
      });
      setComposerOpen(false);
      setCategory(undefined);
      setPurpose("");
      setContent("");
      setOccurredTime(null);
      setNextContactTime(null);
    },
  });
  const updateMutation = useMutation({
    mutationFn: () => {
      const activity = activityDetailQuery.data;
      const category = editDraft?.category ?? activity?.category;
      const draftPurpose = editDraft?.purpose ?? activity?.purpose ?? "";
      const draftContent = editDraft?.content ?? activity?.content;
      const baselineOccurredTime = activity ? dayjs(activity.occurredTime) : null;
      const draftOccurredTime =
        editDraft?.occurredTime === undefined ? baselineOccurredTime : editDraft.occurredTime;
      const baselineNextContactTime =
        activity?.nextContactTime === null || activity?.nextContactTime === undefined
          ? null
          : dayjs(activity.nextContactTime);
      const draftNextContactTime =
        editDraft?.nextContactTime === undefined
          ? baselineNextContactTime
          : editDraft.nextContactTime;
      if (
        apiClient === null ||
        editActivityId === null ||
        activity === undefined ||
        activity.id !== editActivityId ||
        activity.subjectId !== subjectId ||
        activity.subjectType !== subjectType ||
        category === undefined ||
        draftContent === undefined ||
        draftContent.trim().length === 0 ||
        draftOccurredTime === null ||
        !draftOccurredTime.isValid() ||
        (draftNextContactTime !== null && !draftNextContactTime.isValid()) ||
        methodQuery.data?.some((option) => option.value === category) !== true
      ) {
        return Promise.reject(new Error("Activity update is unavailable."));
      }

      return apiClient.updateActivity(activity.id, {
        category,
        content: draftContent.trim(),
        occurredTime: draftOccurredTime.format("YYYY-MM-DDTHH:mm:ss"),
        nextContactTime:
          draftNextContactTime === null ? null : draftNextContactTime.format("YYYY-MM-DDTHH:mm:ss"),
        ...(draftPurpose.trim().length === 0 ? {} : { purpose: draftPurpose.trim() }),
        relations: activity.relations.map((relation) => ({ ...relation })),
        version: activity.version,
      });
    },
    onSuccess: (activity) => {
      queryClient.setQueryData(activityKeys.detail(identityKey, activity.id), activity);
      void queryClient.invalidateQueries({
        queryKey: activityKeys.timeline(identityKey, subjectType, subjectId),
      });
      setEditActivityId(null);
      setEditDraft(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => {
      const activity = activityDetailQuery.data;
      if (
        apiClient === null ||
        deleteActivityId === null ||
        activity === undefined ||
        activity.id !== deleteActivityId ||
        activity.subjectId !== subjectId ||
        activity.subjectType !== subjectType
      ) {
        return Promise.reject(new Error("Activity delete is unavailable."));
      }
      return apiClient.deleteActivity(activity.id, activity.version);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: activityKeys.timeline(identityKey, subjectType, subjectId),
      });
      setDeleteActivityId(null);
    },
  });

  if (!canReadActivities) return null;

  const activities = timelineQuery.data
    ? toPageResult(timelineQuery.data, toActivityTimelineItem).items
    : [];
  const canSubmit =
    category !== undefined &&
    content.trim().length > 0 &&
    occurredTime !== null &&
    methodQuery.data?.some((option) => option.value === category) === true;
  const selectedActivity = activityDetailQuery.data;
  const editCategory = editDraft?.category ?? selectedActivity?.category;
  const editPurpose = editDraft?.purpose ?? selectedActivity?.purpose ?? "";
  const editContent = editDraft?.content ?? selectedActivity?.content ?? "";
  const baselineEditOccurredTime = selectedActivity ? dayjs(selectedActivity.occurredTime) : null;
  const editOccurredTime =
    editDraft?.occurredTime === undefined ? baselineEditOccurredTime : editDraft.occurredTime;
  const baselineEditNextContactTime =
    selectedActivity?.nextContactTime === null || selectedActivity?.nextContactTime === undefined
      ? null
      : dayjs(selectedActivity.nextContactTime);
  const editNextContactTime =
    editDraft?.nextContactTime === undefined
      ? baselineEditNextContactTime
      : editDraft.nextContactTime;
  const canSaveEdit =
    editActivityId !== null &&
    selectedActivity?.id === editActivityId &&
    selectedActivity.subjectId === subjectId &&
    selectedActivity.subjectType === subjectType &&
    editCategory !== undefined &&
    editContent.trim().length > 0 &&
    editOccurredTime !== null &&
    editOccurredTime.isValid() &&
    (editNextContactTime === null || editNextContactTime.isValid()) &&
    methodQuery.data?.some((option) => option.value === editCategory) === true;
  const canConfirmDelete =
    deleteActivityId !== null &&
    selectedActivity?.id === deleteActivityId &&
    selectedActivity.subjectId === subjectId &&
    selectedActivity.subjectType === subjectType &&
    !deleteMutation.isPending;

  function openComposer() {
    createMutation.reset();
    setCategory(undefined);
    setPurpose("");
    setContent("");
    setOccurredTime(dayjs().second(0).millisecond(0));
    setNextContactTime(null);
    setComposerOpen(true);
  }

  function closeComposer() {
    if (createMutation.isPending) return;
    createMutation.reset();
    setComposerOpen(false);
    setCategory(undefined);
    setPurpose("");
    setContent("");
    setOccurredTime(null);
    setNextContactTime(null);
  }

  function openEditor(activityId: number) {
    updateMutation.reset();
    setEditDraft(null);
    setDeleteActivityId(null);
    setEditActivityId(activityId);
  }

  function closeEditor() {
    if (updateMutation.isPending) return;
    updateMutation.reset();
    setEditDraft(null);
    setEditActivityId(null);
  }

  function openDeleteConfirmation(activityId: number) {
    deleteMutation.reset();
    setEditActivityId(null);
    setEditDraft(null);
    setDeleteActivityId(activityId);
  }

  function closeDeleteConfirmation() {
    if (deleteMutation.isPending) return;
    deleteMutation.reset();
    setDeleteActivityId(null);
  }

  function resolveConflict(resolution: MutationConflictResolution) {
    updateMutation.reset();
    deleteMutation.reset();
    if (resolution === "discard-draft-and-reload") setEditDraft(null);
    if (resolution !== "dismiss") void activityDetailQuery.refetch();
  }

  return (
    <>
      <Card
        extra={
          canCompose ? (
            <Button type="primary" onClick={openComposer}>
              写跟进
            </Button>
          ) : null
        }
        loading={timelineQuery.isLoading}
        title="跟进记录"
      >
        <Typography.Paragraph type="secondary">
          仅展示服务端在当前记录可见范围内返回的最近 20
          条跟进投影；关联对象、附件和动态字段不会进入此处。
        </Typography.Paragraph>
        {timelineQuery.isError ? (
          <Alert title="跟进记录暂时无法加载" showIcon type="error" />
        ) : (
          <List
            dataSource={activities}
            locale={{ emptyText: "暂无跟进记录" }}
            renderItem={(activity) => {
              const title = [activity.category, activity.purpose].filter(Boolean).join(" · ");
              return (
                <List.Item
                  actions={
                    canCompose && activity.kind === "FOLLOW_UP"
                      ? [
                          <Button key="edit" type="link" onClick={() => openEditor(activity.id)}>
                            编辑
                          </Button>,
                          <Button
                            danger
                            key="delete"
                            type="link"
                            onClick={() => openDeleteConfirmation(activity.id)}
                          >
                            删除
                          </Button>,
                        ]
                      : undefined
                  }
                >
                  <List.Item.Meta
                    description={
                      <>
                        <Typography.Paragraph style={{ marginBottom: 4, whiteSpace: "pre-wrap" }}>
                          {activity.content}
                        </Typography.Paragraph>
                        <Typography.Text type="secondary">
                          发生时间：{activity.occurredTime}
                          {activity.nextContactTime
                            ? ` · 下次联系：${activity.nextContactTime}`
                            : ""}
                        </Typography.Text>
                      </>
                    }
                    title={title || "跟进记录"}
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>
      <Modal
        destroyOnHidden
        footer={
          <>
            <Button disabled={createMutation.isPending} onClick={closeComposer}>
              取消
            </Button>
            <Button
              disabled={!canSubmit || methodQuery.isLoading || methodQuery.isError}
              loading={createMutation.isPending}
              type="primary"
              onClick={() => createMutation.mutate()}
            >
              提交跟进
            </Button>
          </>
        }
        open={composerOpen}
        title="写跟进"
        onCancel={closeComposer}
      >
        <Typography.Paragraph type="secondary">
          方式只能从服务端当前下发的目录选择。本次仅记录当前对象的方式、目的、内容、发生时间和可选下次联系时间；关联对象与附件不在此流程中处理。
        </Typography.Paragraph>
        {methodQuery.isError ? (
          <Alert title="跟进方式暂时无法加载" showIcon type="error" />
        ) : (
          <Select
            aria-label="跟进方式"
            disabled={methodQuery.isLoading}
            loading={methodQuery.isLoading}
            options={[...(methodQuery.data ?? [])]}
            placeholder="请选择跟进方式"
            style={{ width: "100%" }}
            value={category}
            onChange={setCategory}
          />
        )}
        <Input
          aria-label="跟进目的"
          maxLength={200}
          placeholder="可选：输入跟进目的"
          style={{ marginTop: 12 }}
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
        />
        <Input.TextArea
          aria-label="跟进内容"
          autoSize={{ minRows: 4, maxRows: 8 }}
          maxLength={10000}
          placeholder="请输入跟进内容"
          style={{ marginTop: 12 }}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <DatePicker
          aria-label="跟进时间"
          showTime
          style={{ marginTop: 12, width: "100%" }}
          value={occurredTime}
          onChange={setOccurredTime}
        />
        <DatePicker
          allowClear
          aria-label="下次联系时间"
          placeholder="可选：选择下次联系时间"
          showTime
          style={{ marginTop: 12, width: "100%" }}
          value={nextContactTime}
          onChange={setNextContactTime}
        />
        {createMutation.isError ? (
          <Alert
            title={
              createMutation.error instanceof ApiError
                ? createMutation.error.message
                : "跟进记录暂时无法提交"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
      </Modal>
      <Modal
        destroyOnHidden
        footer={
          <>
            <Button disabled={updateMutation.isPending} onClick={closeEditor}>
              取消
            </Button>
            <Button
              disabled={!canSaveEdit || methodQuery.isLoading || methodQuery.isError}
              loading={updateMutation.isPending}
              type="primary"
              onClick={() => updateMutation.mutate()}
            >
              保存更改
            </Button>
          </>
        }
        open={editActivityId !== null}
        title="编辑跟进"
        onCancel={closeEditor}
      >
        <Typography.Paragraph type="secondary">
          保存会使用刚从服务端读取的版本和完整关系基线；不会修改关联对象。清空下次联系时间会在本次完整更新中移除它。
        </Typography.Paragraph>
        {activityDetailQuery.isLoading ? <Spin /> : null}
        {activityDetailQuery.isError ? (
          <Alert title="跟进记录编辑基线暂时无法加载" showIcon type="error" />
        ) : null}
        {methodQuery.isError ? <Alert title="跟进方式暂时无法加载" showIcon type="error" /> : null}
        {selectedActivity?.id === editActivityId ? (
          <>
            <Select
              aria-label="编辑跟进方式"
              disabled={methodQuery.isLoading}
              loading={methodQuery.isLoading}
              options={[...(methodQuery.data ?? [])]}
              placeholder="请选择跟进方式"
              style={{ width: "100%" }}
              value={editCategory}
              onChange={(nextCategory) =>
                setEditDraft((current) => ({ ...(current ?? {}), category: nextCategory }))
              }
            />
            <Input
              aria-label="编辑跟进目的"
              maxLength={200}
              placeholder="可选：输入跟进目的"
              style={{ marginTop: 12 }}
              value={editPurpose}
              onChange={(event) =>
                setEditDraft((current) => ({ ...(current ?? {}), purpose: event.target.value }))
              }
            />
            <Input.TextArea
              aria-label="编辑跟进内容"
              autoSize={{ minRows: 4, maxRows: 8 }}
              maxLength={10000}
              placeholder="请输入跟进内容"
              style={{ marginTop: 12 }}
              value={editContent}
              onChange={(event) =>
                setEditDraft((current) => ({ ...(current ?? {}), content: event.target.value }))
              }
            />
            <DatePicker
              aria-label="编辑跟进时间"
              showTime
              style={{ marginTop: 12, width: "100%" }}
              value={editOccurredTime}
              onChange={(nextOccurredTime) =>
                setEditDraft((current) => ({ ...(current ?? {}), occurredTime: nextOccurredTime }))
              }
            />
            <DatePicker
              allowClear
              aria-label="编辑下次联系时间"
              placeholder="可选：选择下次联系时间"
              showTime
              style={{ marginTop: 12, width: "100%" }}
              value={editNextContactTime}
              onChange={(nextContactTime) =>
                setEditDraft((current) => ({ ...(current ?? {}), nextContactTime }))
              }
            />
          </>
        ) : null}
        <MutationConflictNotice error={updateMutation.error} onResolve={resolveConflict} />
        {mutationErrorMessage(updateMutation.error, "跟进记录暂时无法更新") !== null ? (
          <Alert
            title={mutationErrorMessage(updateMutation.error, "跟进记录暂时无法更新")}
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
      </Modal>
      <Modal
        destroyOnHidden
        footer={
          <>
            <Button disabled={deleteMutation.isPending} onClick={closeDeleteConfirmation}>
              取消
            </Button>
            <Button
              danger
              disabled={!canConfirmDelete}
              loading={deleteMutation.isPending}
              type="primary"
              onClick={() => deleteMutation.mutate()}
            >
              删除跟进
            </Button>
          </>
        }
        open={deleteActivityId !== null}
        title="删除跟进"
        onCancel={closeDeleteConfirmation}
      >
        <Typography.Paragraph type="secondary">
          删除前会读取服务端当前版本。删除后，服务端会再次校验当前成员资格、活动状态和并发版本。
        </Typography.Paragraph>
        {activityDetailQuery.isLoading ? <Spin /> : null}
        {activityDetailQuery.isError ? (
          <Alert title="跟进记录删除基线暂时无法加载" showIcon type="error" />
        ) : null}
        <MutationConflictNotice error={deleteMutation.error} onResolve={resolveConflict} />
        {mutationErrorMessage(deleteMutation.error, "跟进记录暂时无法删除") !== null ? (
          <Alert
            title={mutationErrorMessage(deleteMutation.error, "跟进记录暂时无法删除")}
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
      </Modal>
    </>
  );
}
