import { useQuery } from "@tanstack/react-query";
import { Alert, Form, Select, Spin } from "antd";
import { Controller, type Control } from "react-hook-form";

import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import type { CustomerBaseFormValues } from "../model/customer-form";

/** Lets a writer select known server-visible tags or explicitly enter a new one. */
export function CustomerCreateTagSelect({
  control,
  disabled,
}: Readonly<{
  control: Control<CustomerBaseFormValues>;
  disabled: boolean;
}>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const identityKey = authState?.identityKey ?? "pending";
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const tagCatalogQuery = useQuery({
    queryKey: ["customer-tag-catalog", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer tag catalog is unavailable."))
        : apiClient.getCustomerTagCatalog(),
    enabled: apiClient !== null && canReadCustomers,
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
            label="客户标签"
            validateStatus={fieldState.error ? "error" : undefined}
          >
            <Select
              allowClear
              aria-label="客户标签"
              disabled={disabled}
              loading={tagCatalogQuery.isLoading}
              mode="tags"
              notFoundContent={tagCatalogQuery.isLoading ? <Spin size="small" /> : "暂无可见标签"}
              options={(tagCatalogQuery.data ?? []).map((tag) => ({ label: tag, value: tag }))}
              placeholder="选择或输入客户标签"
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
