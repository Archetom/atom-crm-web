import { useQuery } from "@tanstack/react-query";
import { Alert, Form, Select, Spin } from "antd";
import { Controller, type Control } from "react-hook-form";

import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import type { ContactBaseFormValues } from "../model/contact-form";

/** Lets a writer select known server-visible tags or explicitly enter a new one. */
export function ContactCreateTagSelect({
  control,
  disabled,
}: Readonly<{
  control: Control<ContactBaseFormValues>;
  disabled: boolean;
}>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const identityKey = authState?.identityKey ?? "pending";
  const canReadContacts = hasAuthority(authorization, authority.contactsRead);
  const tagCatalogQuery = useQuery({
    queryKey: ["contact-tag-catalog", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Contact tag catalog is unavailable."))
        : apiClient.getContactTagCatalog(),
    enabled: apiClient !== null && canReadContacts,
  });

  return (
    <>
      <Controller
        control={control}
        name="tags"
        render={({ field, fieldState }) => (
          <Form.Item
            extra="可选择当前可见标签，也可输入新标签后按 Enter 确认。"
            help={fieldState.error?.message}
            label="联系人标签"
            validateStatus={fieldState.error ? "error" : undefined}
          >
            <Select
              allowClear
              aria-label="联系人标签"
              disabled={disabled}
              loading={tagCatalogQuery.isLoading}
              mode="tags"
              notFoundContent={tagCatalogQuery.isLoading ? <Spin size="small" /> : "暂无可见标签"}
              options={(tagCatalogQuery.data ?? []).map((tag) => ({ label: tag, value: tag }))}
              placeholder="选择或输入联系人标签"
              tokenSeparators={[",", "，"]}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(values: string[]) => field.onChange(values)}
            />
          </Form.Item>
        )}
      />
      {tagCatalogQuery.isError ? (
        <Alert
          title="标签目录暂时无法加载；仍可输入新标签，服务端会最终校验。"
          showIcon
          type="warning"
        />
      ) : null}
    </>
  );
}
