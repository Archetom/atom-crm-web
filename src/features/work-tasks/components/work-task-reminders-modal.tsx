import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import { useState } from "react";

import type { ApiClient } from "~/api/client/api-client";
import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict } from "~/api/errors/mutation-conflict";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import {
  MutationConflictNotice,
  type MutationConflictResolution,
} from "~/components/feedback/mutation-conflict-notice";

import { workTaskKeys } from "../model/query-keys";
import { workTaskReminderKeys } from "../model/reminder-query-keys";
import { workTaskSeriesKeys } from "../model/series-query-keys";
import {
  hasValidWorkTaskReminderSteps,
  isWorkTaskReminderRecipient,
  maximumWorkTaskReminderOffsetMinutes,
  maximumWorkTaskReminderSteps,
  workTaskReminderRecipients,
  workTaskReminderTimings,
  type WorkTaskReminderPlanBaseline,
  type WorkTaskReminderRecipient,
  type WorkTaskReminderStep,
  type WorkTaskReminderTiming,
} from "../model/work-task-reminder-plan";

interface WorkTaskRemindersModalProps {
  taskId: number;
  open: boolean;
  onClose: () => void;
}

interface WorkTaskSeriesRemindersModalProps {
  seriesId: number;
  canManage: boolean;
  open: boolean;
  onClose: () => void;
}

type ReminderTarget =
  { readonly kind: "task"; readonly id: number } | { readonly kind: "series"; readonly id: number };

interface ReminderPlanModalProps {
  target: ReminderTarget;
  canManage?: boolean;
  open: boolean;
  onClose: () => void;
}

const timingOptions: Readonly<Record<WorkTaskReminderTiming, string>> = {
  BEFORE_DUE: "到期前",
  AT_DUE: "到期时",
  OVERDUE: "逾期后",
};

const recipientOptions: Readonly<Record<WorkTaskReminderRecipient, string>> = {
  ASSIGNEE: "处理人",
  CREATOR: "创建人",
  FOLLOWERS: "关注人",
};

function toDraft(step: WorkTaskReminderStep): WorkTaskReminderStep {
  return { ...step, recipientRoles: [...step.recipientRoles] };
}

function emptyStep(): WorkTaskReminderStep {
  return { timing: "AT_DUE", offsetMinutes: 0, recipientRoles: ["ASSIGNEE"] };
}

function getPlan(
  apiClient: ApiClient,
  target: ReminderTarget,
): Promise<WorkTaskReminderPlanBaseline> {
  return target.kind === "task"
    ? apiClient.getWorkTaskReminderPlan(target.id)
    : apiClient.getWorkTaskSeriesReminderPlan(target.id);
}

function replacePlan(
  apiClient: ApiClient,
  target: ReminderTarget,
  steps: WorkTaskReminderStep[],
  version: number,
): Promise<WorkTaskReminderPlanBaseline> {
  const request = {
    steps: steps.map((step) => ({ ...step, recipientRoles: [...step.recipientRoles] })),
    version,
  };
  return target.kind === "task"
    ? apiClient.replaceWorkTaskReminderPlan(target.id, request)
    : apiClient.replaceWorkTaskSeriesReminderPlan(target.id, request);
}

function targetLabel(target: ReminderTarget): string {
  return target.kind === "task" ? "任务" : "周期任务未来";
}

/**
 * Edits only the dedicated, versioned reminder baseline. A series template is
 * deliberately never built from a recurrence-list item or a generated task.
 */
function ReminderPlanModal({ target, canManage, open, onClose }: Readonly<ReminderPlanModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [stepsDraft, setStepsDraft] = useState<WorkTaskReminderStep[] | null>(null);
  const identityKey = authState?.identityKey ?? "pending";
  const hasTaskReminderAuthority =
    hasAuthority(authorization, authority.workTasksRead) &&
    hasAuthority(authorization, authority.workTasksWrite) &&
    hasAuthority(authorization, authority.workTasksManage);
  const canManageReminders =
    target.kind === "series" ? canManage === true : hasTaskReminderAuthority;
  const planKey =
    target.kind === "task"
      ? workTaskReminderKeys.task(identityKey, target.id)
      : workTaskReminderKeys.series(identityKey, target.id);
  const reminderPlanQuery = useQuery({
    queryKey: planKey,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error(`${targetLabel(target)}提醒基线暂时不可用。`))
        : getPlan(apiClient, target),
    enabled: apiClient !== null && open && canManageReminders,
  });
  const reminderSteps: readonly WorkTaskReminderStep[] =
    stepsDraft ?? reminderPlanQuery.data?.steps ?? [];
  const replaceReminderPlanMutation = useMutation({
    mutationFn: ({ steps, version }: { steps: WorkTaskReminderStep[]; version: number }) =>
      apiClient === null
        ? Promise.reject(new Error(`${targetLabel(target)}提醒暂时不可用。`))
        : replacePlan(apiClient, target, steps, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKey });
      if (target.kind === "task") {
        void queryClient.invalidateQueries({
          queryKey: workTaskKeys.detail(identityKey, target.id),
        });
        void queryClient.invalidateQueries({ queryKey: workTaskKeys.lists(identityKey) });
      } else {
        void queryClient.invalidateQueries({ queryKey: workTaskSeriesKeys.lists(identityKey) });
      }
      setStepsDraft(null);
      onClose();
    },
  });

  function close() {
    if (replaceReminderPlanMutation.isPending) return;
    replaceReminderPlanMutation.reset();
    setStepsDraft(null);
    onClose();
  }

  function updateStep(index: number, next: WorkTaskReminderStep) {
    setStepsDraft(
      reminderSteps.map((step, currentIndex) => (currentIndex === index ? next : step)),
    );
  }

  function resolveConflict(resolution: MutationConflictResolution) {
    replaceReminderPlanMutation.reset();
    if (resolution === "dismiss") return;
    if (resolution === "discard-draft-and-reload") setStepsDraft(null);
    void queryClient.invalidateQueries({ queryKey: planKey });
  }

  const baseline = reminderPlanQuery.data;
  const validDraft = hasValidWorkTaskReminderSteps(reminderSteps);
  const canSave =
    baseline !== undefined &&
    !reminderPlanQuery.isLoading &&
    !reminderPlanQuery.isFetching &&
    !reminderPlanQuery.isError &&
    validDraft &&
    !replaceReminderPlanMutation.isPending;
  const isSeries = target.kind === "series";
  const reminderTitle = isSeries ? "管理未来提醒" : "管理任务提醒";
  const mutationHasConflict = getMutationConflict(replaceReminderPlanMutation.error) !== null;

  return (
    <Modal
      destroyOnHidden
      footer={
        <Space>
          <Button disabled={replaceReminderPlanMutation.isPending} onClick={close}>
            取消
          </Button>
          <Button
            disabled={!canSave}
            loading={replaceReminderPlanMutation.isPending}
            type="primary"
            onClick={() => {
              if (baseline === undefined) return;
              replaceReminderPlanMutation.mutate({
                steps: reminderSteps.map(toDraft),
                version: baseline.version,
              });
            }}
          >
            保存提醒
          </Button>
        </Space>
      }
      open={open}
      title={reminderTitle}
      onCancel={close}
    >
      <Typography.Paragraph type="secondary">
        {isSeries
          ? "未来提醒模板由服务端完整版本基线提供。每条只定义到期时点、分钟偏移和接收角色；不读取或显示成员名单、未来发生、自动化状态或通知状态。保存会提交完整步骤与 version，服务端重新校验管理资格、下次发生时间与并发。"
          : "提醒计划由服务端完整版本基线提供。每条只定义到期时点、分钟偏移和接收角色；不读取或显示创建人、处理人、关注人名单或通知状态。保存会提交完整步骤与 version，服务端重新校验管理资格、任务开放状态、到期时间与并发。"}
      </Typography.Paragraph>
      {reminderPlanQuery.isLoading ? <Spin /> : null}
      {reminderPlanQuery.isError ? (
        <Alert
          title={`${targetLabel(target)}提醒基线暂时无法加载，无法安全保存`}
          showIcon
          type="error"
        />
      ) : null}
      {baseline !== undefined ? (
        <>
          <List
            dataSource={[...reminderSteps]}
            locale={{ emptyText: isSeries ? "暂无未来提醒" : "暂无任务提醒" }}
            renderItem={(step, index) => {
              const requiresOffset = step.timing !== "AT_DUE";
              return (
                <List.Item
                  actions={[
                    <Button
                      aria-label={`移除提醒 ${index + 1}`}
                      danger
                      disabled={replaceReminderPlanMutation.isPending}
                      key={index}
                      size="small"
                      type="link"
                      onClick={() =>
                        setStepsDraft(
                          reminderSteps.filter((_, currentIndex) => currentIndex !== index),
                        )
                      }
                    >
                      移除
                    </Button>,
                  ]}
                >
                  <Space
                    orientation="vertical"
                    size="small"
                    style={{ display: "flex", width: "100%" }}
                  >
                    <Typography.Text strong>提醒 {index + 1}</Typography.Text>
                    <Select
                      aria-label={`提醒时点 ${index + 1}`}
                      disabled={replaceReminderPlanMutation.isPending}
                      options={workTaskReminderTimings.map((timing) => ({
                        label: timingOptions[timing],
                        value: timing,
                      }))}
                      value={step.timing}
                      onChange={(timing: WorkTaskReminderTiming) =>
                        updateStep(index, {
                          ...step,
                          offsetMinutes: timing === "AT_DUE" ? 0 : Math.max(1, step.offsetMinutes),
                          timing,
                        })
                      }
                    />
                    <InputNumber
                      aria-label={`偏移分钟 ${index + 1}`}
                      disabled={!requiresOffset || replaceReminderPlanMutation.isPending}
                      max={maximumWorkTaskReminderOffsetMinutes}
                      min={requiresOffset ? 1 : 0}
                      precision={0}
                      value={step.offsetMinutes}
                      onChange={(offsetMinutes) =>
                        updateStep(index, {
                          ...step,
                          offsetMinutes: typeof offsetMinutes === "number" ? offsetMinutes : 0,
                        })
                      }
                    />
                    <Checkbox.Group
                      aria-label={`接收角色 ${index + 1}`}
                      disabled={replaceReminderPlanMutation.isPending}
                      options={workTaskReminderRecipients.map((recipient) => ({
                        label: recipientOptions[recipient],
                        value: recipient,
                      }))}
                      value={[...step.recipientRoles]}
                      onChange={(values) =>
                        updateStep(index, {
                          ...step,
                          recipientRoles: values.filter(isWorkTaskReminderRecipient),
                        })
                      }
                    />
                  </Space>
                </List.Item>
              );
            }}
          />
          <Button
            disabled={
              replaceReminderPlanMutation.isPending ||
              reminderSteps.length >= maximumWorkTaskReminderSteps
            }
            onClick={() => setStepsDraft([...reminderSteps, emptyStep()])}
          >
            添加提醒
          </Button>
          {!validDraft ? (
            <Alert
              title="提醒步骤重复或不符合时点、偏移和接收角色限制，调整后才能保存"
              showIcon
              style={{ marginTop: 12 }}
              type="warning"
            />
          ) : null}
        </>
      ) : null}
      {replaceReminderPlanMutation.isError && mutationHasConflict ? (
        <div style={{ marginTop: 12 }}>
          <MutationConflictNotice
            error={replaceReminderPlanMutation.error}
            onResolve={resolveConflict}
          />
        </div>
      ) : null}
      {replaceReminderPlanMutation.isError && !mutationHasConflict ? (
        <Alert
          title={
            replaceReminderPlanMutation.error instanceof ApiError
              ? replaceReminderPlanMutation.error.message
              : `${targetLabel(target)}提醒暂时无法更新`
          }
          showIcon
          style={{ marginTop: 12 }}
          type="error"
        />
      ) : null}
    </Modal>
  );
}

export function WorkTaskRemindersModal({
  taskId,
  open,
  onClose,
}: Readonly<WorkTaskRemindersModalProps>) {
  return <ReminderPlanModal open={open} target={{ id: taskId, kind: "task" }} onClose={onClose} />;
}

export function WorkTaskSeriesRemindersModal({
  seriesId,
  canManage,
  open,
  onClose,
}: Readonly<WorkTaskSeriesRemindersModalProps>) {
  return (
    <ReminderPlanModal
      canManage={canManage}
      open={open}
      target={{ id: seriesId, kind: "series" }}
      onClose={onClose}
    />
  );
}
