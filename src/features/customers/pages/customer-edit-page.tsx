import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Modal, Spin, Typography } from "antd";
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

import { CustomerBaseForm } from "../components/customer-base-form";
import type { CustomerDetail } from "../model/customer-detail";
import {
  customerBaseFormValuesFromDetail,
  toCustomerUpdateRequest,
  type CustomerBaseFormValues,
} from "../model/customer-form";
import { customerKeys } from "../model/query-keys";

import styles from "../components/customer-form-modal.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

export function CustomerEditPage() {
  const { customerId: customerIdParam } = useParams();
  const customerId = parseRouteId(customerIdParam);
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const identityKey = authState?.identityKey ?? "pending";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formBaselineOverride, setFormBaselineOverride] = useState<CustomerDetail | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const [reviewCustomerId, setReviewCustomerId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const customerQuery = useQuery({
    queryKey:
      customerId === null
        ? customerKeys.detail(identityKey, 0)
        : customerKeys.detail(identityKey, customerId),
    queryFn: () =>
      customerId === null || apiClient === null
        ? Promise.reject(new Error("Customer detail is unavailable."))
        : apiClient.getCustomer(customerId),
    enabled: apiClient !== null && customerId !== null,
  });

  const updateMutation = useMutation({
    mutationFn: (request: Parameters<NonNullable<typeof apiClient>["updateCustomer"]>[1]) =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer update is unavailable."))
        : apiClient.updateCustomer(customerId, request),
    onSuccess: (customer) => {
      queryClient.setQueryData(customerKeys.detail(identityKey, customer.id), customer);
      queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
      navigate(`/crm/customers/${customer.id}`, { replace: true });
    },
  });

  if (customerId === null) return <StatusPage kind="not-found" />;

  const formBaseline =
    formBaselineOverride?.id === customerId ? formBaselineOverride : (customerQuery.data ?? null);
  const reviewRequired = reviewCustomerId === customerId;

  if (customerQuery.isLoading) {
    return (
      <div
        aria-label="正在加载客户编辑信息"
        style={{ display: "grid", placeItems: "center", minHeight: 240 }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (customerQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(customerQuery.error)}
        onRetry={() => void customerQuery.refetch()}
      />
    );
  }

  if (formBaseline === null) return <StatusPage kind="unavailable" />;

  function submit(values: CustomerBaseFormValues) {
    if (reviewRequired || formBaseline === null) return;

    const baseline = customerBaseFormValuesFromDetail(formBaseline);
    const request = toCustomerUpdateRequest(values, baseline, formBaseline.version);
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

    const result = await customerQuery.refetch();
    updateMutation.reset();
    if (resolution === "keep-draft-and-reload") {
      setFormBaselineOverride(formBaseline);
      setReviewCustomerId(customerId);
      setNotice("已读取服务器最新版本。为避免自动覆盖，当前草稿已锁定，需明确放弃后才可继续编辑。");
      return;
    }

    if (result.data !== undefined) {
      setFormBaselineOverride(result.data);
      setFormRevision((current) => current + 1);
      setReviewCustomerId(null);
      setNotice("已放弃本地草稿并载入服务器最新版本。");
    }
  }

  const conflict = getMutationConflict(updateMutation.error);
  return (
    <RouteAuthority authority={authority.customersWrite}>
      <Modal
        destroyOnHidden
        footer={null}
        open
        rootClassName={styles.modal}
        title="编辑客户"
        width="min(960px, calc(100vw - 96px))"
        onCancel={() => navigate(`/crm/customers/${customerId}`)}
      >
        <main>
          <Typography.Title className={styles.formHeading} level={4}>
            基本信息
          </Typography.Title>
          {notice ? (
            <Alert title={notice} showIcon type={reviewRequired ? "warning" : "info"} />
          ) : null}
          {updateMutation.isError && conflict === null ? (
            <Alert
              title={
                updateMutation.error instanceof ApiError
                  ? updateMutation.error.message
                  : "客户暂时无法更新"
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
          <CustomerBaseForm
            key={`${formBaseline.id}:${formBaseline.version}:${formRevision}`}
            defaultValues={customerBaseFormValuesFromDetail(formBaseline)}
            disabled={reviewRequired}
            onCancel={() => navigate(`/crm/customers/${customerId}`)}
            onSubmit={submit}
            submitText="保存修改"
            submitting={updateMutation.isPending}
          />
        </main>
      </Modal>
    </RouteAuthority>
  );
}
