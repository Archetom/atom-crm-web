import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict } from "~/api/errors/mutation-conflict";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  MutationConflictNotice,
  type MutationConflictResolution,
} from "~/components/feedback/mutation-conflict-notice";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";

import type { ReturnVisitDetail } from "../model/return-visit-detail";
import {
  toReturnVisitUpdateRequest,
  type ReturnVisitUpdateValues,
} from "../model/return-visit-form";
import {
  returnVisitFormOptions,
  returnVisitSatisfactionOptions,
  type ReturnVisitForm,
  type ReturnVisitSatisfaction,
} from "../model/return-visit-fields";
import { returnVisitDetailPathFromEditSearch } from "../model/return-visit-list-route";
import { returnVisitKeys } from "../model/query-keys";

import styles from "./customer-return-visit-edit-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

interface ReturnVisitEditFormValues {
  visitForm?: ReturnVisitForm;
  satisfaction?: ReturnVisitSatisfaction;
  remark?: string;
  visitTime?: Dayjs | null;
}

type ReturnVisitEditBaseline = ReturnVisitDetail & { remark: string; visitTime: string };

function isReturnVisitEditBaseline(
  returnVisit: ReturnVisitDetail | null,
): returnVisit is ReturnVisitEditBaseline {
  return (
    returnVisit !== null &&
    returnVisit.remark !== null &&
    returnVisit.visitTime !== null &&
    dayjs(returnVisit.visitTime).isValid()
  );
}

function mutationErrorMessage(error: unknown, fallback: string): string | null {
  if (error == null || getMutationConflict(error) !== null) return null;
  return error instanceof ApiError ? error.message : fallback;
}

function ReturnVisitEditForm({
  disabled,
  returnVisit,
  submitting,
  onCancel,
  onSubmit,
}: Readonly<{
  disabled: boolean;
  returnVisit: ReturnVisitEditBaseline;
  submitting: boolean;
  onCancel(): void;
  onSubmit(values: ReturnVisitUpdateValues, changed: boolean): void;
}>) {
  const baselineVisitTime = dayjs(returnVisit.visitTime);

  function submit(values: ReturnVisitEditFormValues) {
    const visitTime = values.visitTime;
    if (visitTime === undefined || visitTime === null || !visitTime.isValid()) return;

    const remark = values.remark ?? "";
    const visitForm = values.visitForm ?? null;
    const satisfaction = values.satisfaction ?? null;
    const unchangedTime = visitTime.isSame(baselineVisitTime, "second");
    const unchangedRemark = remark === (returnVisit.remark ?? "");
    const unchangedVisitForm = visitForm === returnVisit.visitForm;
    const unchangedSatisfaction = satisfaction === returnVisit.satisfaction;
    onSubmit(
      {
        baselineRemark: returnVisit.remark,
        baselineSatisfaction: returnVisit.satisfaction,
        baselineVisitForm: returnVisit.visitForm,
        remark,
        satisfaction,
        version: returnVisit.version,
        visitForm,
        visitTime: unchangedTime
          ? (returnVisit.visitTime ?? "")
          : visitTime.format("YYYY-MM-DDTHH:mm:ss"),
      },
      !unchangedTime || !unchangedRemark || !unchangedVisitForm || !unchangedSatisfaction,
    );
  }

  return (
    <Form
      initialValues={{
        remark: returnVisit.remark ?? "",
        satisfaction: returnVisit.satisfaction ?? undefined,
        visitForm: returnVisit.visitForm ?? undefined,
        visitTime: baselineVisitTime,
      }}
      layout="vertical"
      onFinish={submit}
    >
      <Form.Item label="关联客户">
        <Typography.Text>客户 {returnVisit.customerId}</Typography.Text>
      </Form.Item>
      <Form.Item
        label="回访时间"
        name="visitTime"
        rules={[{ required: true, message: "请选择回访时间" }]}
      >
        <DatePicker
          aria-label="回访时间"
          className={styles.datePicker}
          disabled={disabled || submitting}
          showTime
        />
      </Form.Item>
      <Form.Item label="回访形式" name="visitForm">
        <Select
          allowClear
          aria-label="回访形式"
          disabled={disabled || submitting}
          options={returnVisitFormOptions}
          placeholder="请选择回访形式"
        />
      </Form.Item>
      <Form.Item label="客户满意度" name="satisfaction">
        <Select
          allowClear
          aria-label="客户满意度"
          disabled={disabled || submitting}
          options={returnVisitSatisfactionOptions}
          placeholder="请选择客户满意度"
        />
      </Form.Item>
      <Form.Item
        label="客户反馈"
        name="remark"
        rules={[{ max: 2000, message: "备注不能超过 2000 个字符" }]}
      >
        <Input.TextArea
          aria-label="客户反馈"
          autoSize={{ minRows: 4, maxRows: 8 }}
          disabled={disabled || submitting}
          maxLength={2000}
          placeholder="可选：记录客户反馈"
        />
      </Form.Item>
      <Typography.Paragraph type="secondary">
        保存只更新用户实际修改的回访时间、回访形式、客户满意度和客户反馈，并携带当前
        version。联系人、合同、负责人、动态字段和附件均不会由此表单提交；服务端会保留未提交字段并重新校验写入权限。
      </Typography.Paragraph>
      <Space>
        <Button disabled={submitting} onClick={onCancel}>
          取消
        </Button>
        <Button disabled={disabled} htmlType="submit" loading={submitting} type="primary">
          保存修改
        </Button>
      </Space>
    </Form>
  );
}

export function CustomerReturnVisitEditPage() {
  const { customerId: customerIdParam, returnVisitId: returnVisitIdParam } = useParams();
  const customerId = parseRouteId(customerIdParam);
  const returnVisitId = parseRouteId(returnVisitIdParam);
  const [searchParams] = useSearchParams();
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const [formBaselineOverride, setFormBaselineOverride] = useState<ReturnVisitDetail | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const [reviewReturnVisitId, setReviewReturnVisitId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canReadReturnVisits = hasAuthority(authorization, authority.returnVisitsRead);
  const canWriteReturnVisits = hasAuthority(authorization, authority.returnVisitsWrite);
  const returnVisitQuery = useQuery({
    queryKey:
      returnVisitId === null
        ? returnVisitKeys.detail(identityKey, 0)
        : returnVisitKeys.detail(identityKey, returnVisitId),
    queryFn: () =>
      apiClient === null || returnVisitId === null
        ? Promise.reject(new Error("Return visit detail is unavailable."))
        : apiClient.getReturnVisit(returnVisitId),
    enabled:
      apiClient !== null && returnVisitId !== null && canReadReturnVisits && canWriteReturnVisits,
  });
  const updateMutation = useMutation({
    mutationFn: (request: Parameters<NonNullable<typeof apiClient>["updateReturnVisit"]>[1]) =>
      apiClient === null || returnVisitId === null
        ? Promise.reject(new Error("Return visit update is unavailable."))
        : apiClient.updateReturnVisit(returnVisitId, request),
    onSuccess: (returnVisit) => {
      queryClient.setQueryData(returnVisitKeys.detail(identityKey, returnVisit.id), returnVisit);
      void queryClient.invalidateQueries({ queryKey: returnVisitKeys.lists(identityKey) });
      navigate(
        returnVisitDetailPathFromEditSearch(
          searchParams.toString(),
          returnVisit.customerId,
          returnVisit.id,
        ),
        {
          replace: true,
        },
      );
    },
  });

  if (customerId === null || returnVisitId === null) return <StatusPage kind="not-found" />;
  if (!canReadReturnVisits)
    return <RouteAuthority authority={authority.returnVisitsRead}>{null}</RouteAuthority>;
  if (!canWriteReturnVisits)
    return <RouteAuthority authority={authority.returnVisitsWrite}>{null}</RouteAuthority>;

  const formBaseline =
    formBaselineOverride?.id === returnVisitId
      ? formBaselineOverride
      : (returnVisitQuery.data ?? null);
  const reviewRequired = reviewReturnVisitId === returnVisitId;

  if (returnVisitQuery.isLoading) {
    return (
      <div
        aria-label="正在加载回访编辑信息"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (returnVisitQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(returnVisitQuery.error)}
        onRetry={() => void returnVisitQuery.refetch()}
      />
    );
  }

  if (formBaseline?.customerId !== customerId || !isReturnVisitEditBaseline(formBaseline)) {
    return <StatusPage kind="unavailable" />;
  }

  const returnPath = returnVisitDetailPathFromEditSearch(
    searchParams.toString(),
    customerId,
    returnVisitId,
  );

  function submit(values: ReturnVisitUpdateValues, changed: boolean) {
    if (reviewRequired) return;
    if (!changed) {
      setNotice("未检测到基础字段修改。");
      return;
    }

    setNotice(null);
    updateMutation.mutate(toReturnVisitUpdateRequest(values));
  }

  async function resolveConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      updateMutation.reset();
      return;
    }

    const result = await returnVisitQuery.refetch();
    updateMutation.reset();
    if (resolution === "keep-draft-and-reload") {
      setFormBaselineOverride(formBaseline);
      setReviewReturnVisitId(returnVisitId);
      setNotice("已读取服务器最新版本。为避免自动覆盖，当前草稿已锁定，需明确放弃后才可继续编辑。");
      return;
    }

    if (result.data !== undefined) {
      setFormBaselineOverride(result.data);
      setFormRevision((current) => current + 1);
      setReviewReturnVisitId(null);
      setNotice("已放弃本地草稿并载入服务器最新版本。");
    }
  }

  return (
    <RouteAuthority authority={authority.returnVisitsRead}>
      <RouteAuthority authority={authority.returnVisitsWrite}>
        <main className={styles.page}>
          <section>
            <Button icon={<ArrowLeftOutlined />} type="link" onClick={() => navigate(returnPath)}>
              返回回访详情
            </Button>
            <Typography.Title level={2}>编辑回访</Typography.Title>
            <Typography.Text type="secondary">
              可编辑回访时间、回访形式、客户满意度和客户反馈，并始终携带服务端详情的 version。
            </Typography.Text>
          </section>
          {notice ? (
            <Alert title={notice} showIcon type={reviewRequired ? "warning" : "info"} />
          ) : null}
          {mutationErrorMessage(updateMutation.error, "回访暂时无法更新") !== null ? (
            <Alert
              title={mutationErrorMessage(updateMutation.error, "回访暂时无法更新")}
              showIcon
              type="error"
            />
          ) : null}
          {updateMutation.isError ? (
            <MutationConflictNotice
              error={updateMutation.error}
              onResolve={(resolution) => void resolveConflict(resolution)}
            />
          ) : null}
          <Card title="基本信息">
            <ReturnVisitEditForm
              key={`${formBaseline.id}:${formBaseline.version}:${formRevision}`}
              disabled={reviewRequired}
              returnVisit={formBaseline}
              submitting={updateMutation.isPending}
              onCancel={() => navigate(returnPath)}
              onSubmit={submit}
            />
          </Card>
        </main>
      </RouteAuthority>
    </RouteAuthority>
  );
}
