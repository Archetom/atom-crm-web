import { useQuery } from "@tanstack/react-query";
import { Alert, Form, Select, Spin } from "antd";
import { useState } from "react";
import { Controller, type Control } from "react-hook-form";

import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import type { CustomerBaseFormValues } from "../model/customer-form";

/**
 * Lets callers with assign and organization-read permission override the
 * server's default customer owner using only the server-scoped member directory.
 */
export function CustomerCreateOwnerSelect({
  control,
  disabled,
}: Readonly<{
  control: Control<CustomerBaseFormValues>;
  disabled: boolean;
}>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const [memberKeyword, setMemberKeyword] = useState("");
  const identityKey = authState?.identityKey ?? "pending";
  const canAssignCustomers = hasAuthority(authorization, authority.customersAssign);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canSelectOwner = canAssignCustomers && canReadOrganization;
  const memberQuery = useQuery({
    queryKey: ["member-selector", "customer-create-owner", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer owner selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: memberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && canSelectOwner,
  });

  if (!canSelectOwner) return null;

  return (
    <Controller
      control={control}
      name="ownerActorId"
      render={({ field }) => (
        <>
          <Form.Item extra="不选择时由服务端默认当前成员。" label="负责人">
            <Select
              allowClear
              aria-label="负责人"
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
              value={field.value}
              onBlur={field.onBlur}
              onChange={(value: number | undefined) => field.onChange(value)}
              onSearch={setMemberKeyword}
            />
          </Form.Item>
          {memberQuery.isError ? (
            <Alert
              title="负责人目录暂时无法加载；可留空后由服务端默认当前成员"
              showIcon
              type="warning"
            />
          ) : null}
        </>
      )}
    />
  );
}
