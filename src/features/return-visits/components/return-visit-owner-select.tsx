import { useQuery } from "@tanstack/react-query";
import { Alert, Form, Select, Spin } from "antd";
import { useState } from "react";

import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

/**
 * Offers an optional owner only when the caller can both assign return visits
 * and read the server-scoped active-member directory. Leaving it empty keeps
 * the create contract's server-default-current-member behavior.
 */
export function ReturnVisitOwnerSelect({ disabled }: Readonly<{ disabled: boolean }>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const [memberKeyword, setMemberKeyword] = useState("");
  const identityKey = authState?.identityKey ?? "pending";
  const canAssignReturnVisits = hasAuthority(authorization, authority.returnVisitsAssign);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canSelectOwner = canAssignReturnVisits && canReadOrganization;
  const memberQuery = useQuery({
    queryKey: ["member-selector", "return-visit-create-owner", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Return-visit owner selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: memberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && canSelectOwner,
  });

  if (!canSelectOwner) return null;

  return (
    <>
      <Form.Item extra="不选择时由服务端默认当前成员。" label="回访人" name="ownerActorId">
        <Select
          allowClear
          aria-label="回访人"
          disabled={disabled || memberQuery.isError}
          filterOption={false}
          loading={memberQuery.isLoading}
          notFoundContent={memberQuery.isLoading ? <Spin size="small" /> : "未找到可选择成员"}
          options={(memberQuery.data ?? []).map((member) => ({
            label: member.displayName,
            value: member.actorId,
          }))}
          placeholder="从服务端成员目录选择"
          showSearch
          onSearch={setMemberKeyword}
        />
      </Form.Item>
      {memberQuery.isError ? (
        <Alert
          title="回访人目录暂时无法加载；可留空后由服务端默认当前成员"
          showIcon
          type="warning"
        />
      ) : null}
    </>
  );
}
