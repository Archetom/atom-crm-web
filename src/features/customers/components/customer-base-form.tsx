import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Form, Input, Space } from "antd";
import { useState } from "react";
import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  CustomFieldFormFields,
  validateCustomFieldFormValues,
  type FieldDefinition,
} from "~/components/dynamic-field";
import type { DepartmentOption } from "~/components/entity-selector/department-option";
import type { MemberOption } from "~/components/entity-selector/member-option";
import { FormWorkspace } from "~/components/page/form-workspace";

import {
  customerBaseFormSchema,
  emptyCustomerBaseFormValues,
  type CustomerBaseFormValues,
} from "../model/customer-form";
import { CustomerCreateAddressFields } from "./customer-create-address-fields";
import { CustomerCreateOwnerSelect } from "./customer-create-owner-select";
import { CustomerCreateTagSelect } from "./customer-create-tag-select";

import styles from "./customer-base-form.module.css";

export function CustomerBaseForm({
  cancelText = "取消",
  checkingDuplicate = false,
  customFieldDepartmentOptions = [],
  customFieldDefinitions = [],
  customFieldExtra,
  customFieldMemberOptions = [],
  customFieldMemberOptionsLoading = false,
  defaultValues = emptyCustomerBaseFormValues,
  disabled = false,
  includeAddressFields = false,
  includeOwnerSelection = false,
  includeTagSelection = false,
  onCancel,
  onCheckDuplicate,
  onCustomFieldMemberSearch,
  onSecondarySubmit,
  onSubmit,
  secondarySubmitText,
  submitText,
  submitting,
}: Readonly<{
  cancelText?: string;
  checkingDuplicate?: boolean;
  customFieldDepartmentOptions?: readonly DepartmentOption[];
  customFieldDefinitions?: readonly FieldDefinition[];
  customFieldExtra?: ReactNode;
  customFieldMemberOptions?: readonly MemberOption[];
  customFieldMemberOptionsLoading?: boolean;
  defaultValues?: CustomerBaseFormValues;
  disabled?: boolean;
  includeAddressFields?: boolean;
  includeOwnerSelection?: boolean;
  includeTagSelection?: boolean;
  onCancel(): void;
  onCheckDuplicate?(values: CustomerBaseFormValues): void;
  onCustomFieldMemberSearch?(keyword: string): void;
  onSecondarySubmit?(values: CustomerBaseFormValues): void;
  onSubmit(values: CustomerBaseFormValues): void;
  secondarySubmitText?: string;
  submitText: string;
  submitting: boolean;
}>) {
  const form = useForm<CustomerBaseFormValues>({
    defaultValues,
    resolver: zodResolver(customerBaseFormSchema),
  });
  const [customFieldErrors, setCustomFieldErrors] = useState<Readonly<Record<string, string>>>({});

  function submitWithCustomFields(callback: (values: CustomerBaseFormValues) => void) {
    return (values: CustomerBaseFormValues) => {
      const errors = Object.fromEntries(
        validateCustomFieldFormValues(customFieldDefinitions, values.customFields).map((issue) => [
          issue.code,
          issue.message,
        ]),
      );
      setCustomFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
      callback(values);
    };
  }

  return (
    <Form layout="vertical" onFinish={form.handleSubmit(submitWithCustomFields(onSubmit))}>
      <FormWorkspace
        footer={
          <Space wrap>
            <Button disabled={submitting} htmlType="button" onClick={onCancel}>
              {cancelText}
            </Button>
            {onCheckDuplicate ? (
              <Button
                disabled={disabled || submitting}
                htmlType="button"
                loading={checkingDuplicate}
                onClick={() => void form.handleSubmit((values) => onCheckDuplicate(values))()}
              >
                检查重复
              </Button>
            ) : null}
            <Button disabled={disabled} htmlType="submit" loading={submitting} type="primary">
              {submitText}
            </Button>
            {onSecondarySubmit !== undefined && secondarySubmitText !== undefined ? (
              <Button
                disabled={disabled || submitting}
                htmlType="button"
                onClick={() => void form.handleSubmit(submitWithCustomFields(onSecondarySubmit))()}
              >
                {secondarySubmitText}
              </Button>
            ) : null}
          </Space>
        }
        label="客户基础信息表单"
      >
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Form.Item
              className={styles.fullWidth}
              help={fieldState.error?.message}
              label="客户名称"
              required
              validateStatus={fieldState.error ? "error" : undefined}
            >
              <Input
                {...field}
                autoFocus
                disabled={disabled}
                maxLength={200}
                placeholder="请输入客户名称"
              />
            </Form.Item>
          )}
        />
        <Controller
          control={form.control}
          name="phoneNumber"
          render={({ field, fieldState }) => (
            <Form.Item
              help={fieldState.error?.message}
              label="联系电话"
              validateStatus={fieldState.error ? "error" : undefined}
            >
              <Input
                {...field}
                disabled={disabled}
                inputMode="tel"
                maxLength={16}
                placeholder="例如 +8613812345678"
              />
            </Form.Item>
          )}
        />
        <Controller
          control={form.control}
          name="telephone"
          render={({ field, fieldState }) => (
            <Form.Item
              help={fieldState.error?.message}
              label="座机"
              validateStatus={fieldState.error ? "error" : undefined}
            >
              <Input {...field} disabled={disabled} maxLength={50} placeholder="请输入座机" />
            </Form.Item>
          )}
        />
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Form.Item
              help={fieldState.error?.message}
              label="邮箱"
              validateStatus={fieldState.error ? "error" : undefined}
            >
              <Input
                {...field}
                disabled={disabled}
                inputMode="email"
                maxLength={254}
                placeholder="请输入邮箱"
              />
            </Form.Item>
          )}
        />
        <Controller
          control={form.control}
          name="website"
          render={({ field, fieldState }) => (
            <Form.Item
              help={fieldState.error?.message}
              label="网站"
              validateStatus={fieldState.error ? "error" : undefined}
            >
              <Input
                {...field}
                disabled={disabled}
                inputMode="url"
                maxLength={500}
                placeholder="请输入网站"
              />
            </Form.Item>
          )}
        />
        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <Form.Item
              className={styles.fullWidth}
              help={fieldState.error?.message}
              label="说明"
              validateStatus={fieldState.error ? "error" : undefined}
            >
              <Input.TextArea {...field} disabled={disabled} maxLength={2000} rows={4} />
            </Form.Item>
          )}
        />
        {includeOwnerSelection ? (
          <CustomerCreateOwnerSelect control={form.control} disabled={disabled} />
        ) : null}
        {includeAddressFields ? (
          <CustomerCreateAddressFields control={form.control} disabled={disabled} />
        ) : null}
        <Controller
          control={form.control}
          name="customFields"
          render={({ field }) => (
            <CustomFieldFormFields
              departmentOptions={customFieldDepartmentOptions}
              definitions={customFieldDefinitions}
              disabled={disabled}
              errors={customFieldErrors}
              memberOptions={customFieldMemberOptions}
              memberOptionsLoading={customFieldMemberOptionsLoading}
              onMemberSearch={onCustomFieldMemberSearch}
              values={field.value}
              onChange={field.onChange}
              onFieldChange={(code) =>
                setCustomFieldErrors((current) => {
                  if (current[code] === undefined) return current;
                  return Object.fromEntries(
                    Object.entries(current).filter(([currentCode]) => currentCode !== code),
                  );
                })
              }
            />
          )}
        />
        {customFieldExtra}
        {includeTagSelection ? (
          <CustomerCreateTagSelect control={form.control} disabled={disabled} />
        ) : null}
      </FormWorkspace>
    </Form>
  );
}
