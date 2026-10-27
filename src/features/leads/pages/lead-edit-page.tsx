import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Card, Spin, Typography } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict } from "~/api/errors/mutation-conflict";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { MutationConflictNotice } from "~/components/feedback/mutation-conflict-notice";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";

import { LeadBaseForm } from "../components/lead-base-form";
import type { LeadDetail } from "../model/lead-detail";
import {
  leadBaseFormValuesFromDetail,
  toLeadUpdateRequest,
  type LeadBaseFormValues,
} from "../model/lead-form";
import { leadKeys } from "../model/query-keys";

import styles from "./lead-edit-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

export function LeadEditPage() {
  const { leadId: leadIdParam } = useParams();
  const leadId = parseRouteId(leadIdParam);
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const identityKey = authState?.identityKey ?? "pending";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formBaselineOverride, setFormBaselineOverride] = useState<LeadDetail | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const [reviewLeadId, setReviewLeadId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const leadQuery = useQuery({
    queryKey:
      leadId === null ? leadKeys.detail(identityKey, 0) : leadKeys.detail(identityKey, leadId),
    queryFn: () =>
      leadId === null || apiClient === null
        ? Promise.reject(new Error("Lead detail is unavailable."))
        : apiClient.getLead(leadId),
    enabled: apiClient !== null && leadId !== null,
  });
  const updateMutation = useMutation({
    mutationFn: (request: Parameters<NonNullable<typeof apiClient>["updateLead"]>[1]) =>
      apiClient === null || leadId === null
        ? Promise.reject(new Error("Lead update is unavailable."))
        : apiClient.updateLead(leadId, request),
    onSuccess: (lead) => {
      queryClient.setQueryData(leadKeys.detail(identityKey, lead.id), lead);
      queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
      navigate(`/crm/leads/${lead.id}`, { replace: true });
    },
  });

  if (leadId === null) return <StatusPage kind="not-found" />;

  const formBaseline =
    formBaselineOverride?.id === leadId ? formBaselineOverride : (leadQuery.data ?? null);
  const reviewRequired = reviewLeadId === leadId;

  if (leadQuery.isLoading) {
    return (
      <div
        aria-label="正在加载线索编辑信息"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (leadQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(leadQuery.error)}
        onRetry={() => void leadQuery.refetch()}
      />
    );
  }

  if (formBaseline === null) return <StatusPage kind="unavailable" />;

  function submit(values: LeadBaseFormValues) {
    if (reviewRequired || formBaseline === null) return;

    const baseline = leadBaseFormValuesFromDetail(formBaseline);
    const request = toLeadUpdateRequest(values, baseline, formBaseline.version);
    if (Object.keys(request).length === 1) {
      setNotice("未检测到基础字段修改。");
      return;
    }

    setNotice(null);
    updateMutation.mutate(request);
  }

  async function resolveConflict(
    resolution: "dismiss" | "keep-draft-and-reload" | "discard-draft-and-reload",
  ) {
    if (resolution === "dismiss") {
      updateMutation.reset();
      return;
    }

    const result = await leadQuery.refetch();
    updateMutation.reset();
    if (resolution === "keep-draft-and-reload") {
      setFormBaselineOverride(formBaseline);
      setReviewLeadId(leadId);
      setNotice("已读取服务器最新版本。为避免自动覆盖，当前草稿已锁定，需明确放弃后才可继续编辑。");
      return;
    }

    if (result.data !== undefined) {
      setFormBaselineOverride(result.data);
      setFormRevision((current) => current + 1);
      setReviewLeadId(null);
      setNotice("已放弃本地草稿并载入服务器最新版本。");
    }
  }

  const conflict = getMutationConflict(updateMutation.error);
  return (
    <RouteAuthority authority={authority.leadsWrite}>
      <main className={styles.page}>
        <section>
          <Typography.Title level={2}>编辑线索</Typography.Title>
          <Typography.Text type="secondary">
            仅提交发生变化的基础字段，并始终携带加载时的 version。
          </Typography.Text>
        </section>
        {notice ? (
          <Alert title={notice} showIcon type={reviewRequired ? "warning" : "info"} />
        ) : null}
        {updateMutation.isError && conflict === null ? (
          <Alert
            title={
              updateMutation.error instanceof ApiError
                ? updateMutation.error.message
                : "线索暂时无法更新"
            }
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
        <Card title="基础信息">
          <LeadBaseForm
            key={`${formBaseline.id}:${formBaseline.version}:${formRevision}`}
            defaultValues={leadBaseFormValuesFromDetail(formBaseline)}
            disabled={reviewRequired}
            includeNextContactTime
            onCancel={() => navigate(`/crm/leads/${leadId}`)}
            onSubmit={submit}
            submitText="保存修改"
            submitting={updateMutation.isPending}
          />
        </Card>
      </main>
    </RouteAuthority>
  );
}
