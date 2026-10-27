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

import { ContactBaseForm } from "../components/contact-base-form";
import type { ContactDetail } from "../model/contact-detail";
import {
  contactBaseFormValuesFromDetail,
  toContactUpdateRequest,
  type ContactBaseFormValues,
} from "../model/contact-form";
import { contactKeys } from "../model/query-keys";

import styles from "./contact-edit-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

export function ContactEditPage() {
  const { contactId: contactIdParam } = useParams();
  const contactId = parseRouteId(contactIdParam);
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const identityKey = authState?.identityKey ?? "pending";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formBaselineOverride, setFormBaselineOverride] = useState<ContactDetail | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const [reviewContactId, setReviewContactId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const contactQuery = useQuery({
    queryKey:
      contactId === null
        ? contactKeys.detail(identityKey, 0)
        : contactKeys.detail(identityKey, contactId),
    queryFn: () =>
      contactId === null || apiClient === null
        ? Promise.reject(new Error("Contact detail is unavailable."))
        : apiClient.getContact(contactId),
    enabled: apiClient !== null && contactId !== null,
  });
  const updateMutation = useMutation({
    mutationFn: (request: Parameters<NonNullable<typeof apiClient>["updateContact"]>[1]) =>
      apiClient === null || contactId === null
        ? Promise.reject(new Error("Contact update is unavailable."))
        : apiClient.updateContact(contactId, request),
    onSuccess: (contact) => {
      queryClient.setQueryData(contactKeys.detail(identityKey, contact.id), contact);
      queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
      navigate(`/crm/contacts/${contact.id}`, { replace: true });
    },
  });

  if (contactId === null) return <StatusPage kind="not-found" />;

  const formBaseline =
    formBaselineOverride?.id === contactId ? formBaselineOverride : (contactQuery.data ?? null);
  const reviewRequired = reviewContactId === contactId;

  if (contactQuery.isLoading) {
    return (
      <div
        aria-label="正在加载联系人编辑信息"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (contactQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(contactQuery.error)}
        onRetry={() => void contactQuery.refetch()}
      />
    );
  }

  if (formBaseline === null) return <StatusPage kind="unavailable" />;

  function submit(values: ContactBaseFormValues) {
    if (reviewRequired || formBaseline === null) return;

    const baseline = contactBaseFormValuesFromDetail(formBaseline);
    const request = toContactUpdateRequest(values, baseline, formBaseline.version);
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

    const result = await contactQuery.refetch();
    updateMutation.reset();
    if (resolution === "keep-draft-and-reload") {
      setFormBaselineOverride(formBaseline);
      setReviewContactId(contactId);
      setNotice("已读取服务器最新版本。为避免自动覆盖，当前草稿已锁定，需明确放弃后才可继续编辑。");
      return;
    }

    if (result.data !== undefined) {
      setFormBaselineOverride(result.data);
      setFormRevision((current) => current + 1);
      setReviewContactId(null);
      setNotice("已放弃本地草稿并载入服务器最新版本。");
    }
  }

  const conflict = getMutationConflict(updateMutation.error);
  return (
    <RouteAuthority authority={authority.contactsWrite}>
      <main className={styles.page}>
        <section>
          <Typography.Title level={2}>编辑联系人</Typography.Title>
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
                : "联系人暂时无法更新"
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
          <ContactBaseForm
            key={`${formBaseline.id}:${formBaseline.version}:${formRevision}`}
            defaultValues={contactBaseFormValuesFromDetail(formBaseline)}
            disabled={reviewRequired}
            includeNextContactTime
            onCancel={() => navigate(`/crm/contacts/${contactId}`)}
            onSubmit={submit}
            submitText="保存修改"
            submitting={updateMutation.isPending}
          />
        </Card>
      </main>
    </RouteAuthority>
  );
}
