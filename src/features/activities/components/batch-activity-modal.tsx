import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, DatePicker, Form, Input, Modal, Select, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";

import { toBatchActivityCreateRequests } from "../model/batch-activity";
import type { ActivitySubjectType } from "../model/activity-timeline";

interface BatchActivityModalProps {
  objectLabel: string;
  open: boolean;
  subjectIds: readonly number[];
  subjectType: ActivitySubjectType;
  onCancel(): void;
  onSuccess(createdCount: number): void;
}

/**
 * The selected IDs come from one already-authorized list surface. This dialog
 * records the same follow-up projection for every selected record and leaves
 * record scope, tenant, actor, relationships, and atomicity to the API.
 */
export function BatchActivityModal({ open, ...props }: Readonly<BatchActivityModalProps>) {
  return open ? <BatchActivityModalContent {...props} /> : null;
}

function BatchActivityModalContent({
  objectLabel,
  subjectIds,
  subjectType,
  onCancel,
  onSuccess,
}: Readonly<Omit<BatchActivityModalProps, "open">>) {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const [category, setCategory] = useState<string>();
  const [purpose, setPurpose] = useState("");
  const [content, setContent] = useState("");
  const [occurredTime, setOccurredTime] = useState<Dayjs | null>(() =>
    dayjs().second(0).millisecond(0),
  );
  const methodQuery = useQuery({
    queryKey: ["activity-method-options", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Activity method options are unavailable."))
        : apiClient.getActivityMethods(),
    enabled: apiClient !== null,
  });
  const createMutation = useMutation({
    mutationFn: () => {
      const selectedMethod = methodQuery.data?.find((option) => option.value === category);
      const request =
        selectedMethod === undefined || occurredTime === null || !occurredTime.isValid()
          ? null
          : toBatchActivityCreateRequests(subjectIds, subjectType, {
              category: selectedMethod.value,
              content,
              occurredTime: occurredTime.format("YYYY-MM-DDTHH:mm:ss"),
              purpose,
            });
      return apiClient === null || request === null
        ? Promise.reject(new Error("Batch activity creation is unavailable."))
        : apiClient.createActivitiesBatch(request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["activities", "timeline", identityKey] });
      onSuccess(subjectIds.length);
    },
  });
  const canSubmit =
    subjectIds.length > 0 &&
    subjectIds.length <= 100 &&
    category !== undefined &&
    content.trim().length > 0 &&
    occurredTime !== null &&
    occurredTime.isValid() &&
    methodQuery.data?.some((option) => option.value === category) === true;

  function close() {
    if (createMutation.isPending) return;
    createMutation.reset();
    onCancel();
  }

  function submit() {
    if (canSubmit) createMutation.mutate();
  }

  return (
    <Modal
      destroyOnHidden
      footer={
        <>
          <Button disabled={createMutation.isPending} onClick={close}>
            取消
          </Button>
          <Button
            disabled={!canSubmit || methodQuery.isLoading || methodQuery.isError}
            loading={createMutation.isPending}
            type="primary"
            onClick={submit}
          >
            批量提交跟进
          </Button>
        </>
      }
      open
      title={`批量写${objectLabel}跟进`}
      onCancel={close}
    >
      <Typography.Paragraph type="secondary">
        将为已选择的 {subjectIds.length} 个{objectLabel}
        原子创建相同的跟进记录。提交前，服务端会重新校验每条记录的当前成员资格、数据范围、写入权限和同租户关系；任一条不能写入时不会部分创建。
      </Typography.Paragraph>
      {subjectIds.length > 100 ? (
        <Alert title="一次最多可批量记录 100 条跟进" showIcon type="error" />
      ) : null}
      {methodQuery.isError ? <Alert title="跟进方式暂时无法加载" showIcon type="error" /> : null}
      <Form layout="vertical" onFinish={submit}>
        <Form.Item label="跟进方式" required>
          <Select
            aria-label="批量跟进方式"
            disabled={methodQuery.isLoading}
            loading={methodQuery.isLoading}
            options={[...(methodQuery.data ?? [])]}
            placeholder="请选择跟进方式"
            value={category}
            onChange={setCategory}
          />
        </Form.Item>
        <Form.Item label="跟进目的">
          <Input
            aria-label="批量跟进目的"
            maxLength={200}
            placeholder="可选：输入跟进目的"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          />
        </Form.Item>
        <Form.Item label="跟进内容" required>
          <Input.TextArea
            aria-label="批量跟进内容"
            autoSize={{ minRows: 4, maxRows: 8 }}
            maxLength={10000}
            placeholder="请输入跟进内容"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </Form.Item>
        <Form.Item label="跟进时间" required>
          <DatePicker
            aria-label="批量跟进时间"
            showTime
            style={{ width: "100%" }}
            value={occurredTime}
            onChange={setOccurredTime}
          />
        </Form.Item>
      </Form>
      {createMutation.isError ? (
        <Alert
          title={
            createMutation.error instanceof ApiError
              ? createMutation.error.message
              : "批量跟进暂时无法提交"
          }
          showIcon
          type="error"
        />
      ) : null}
    </Modal>
  );
}
