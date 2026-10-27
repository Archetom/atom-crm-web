import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Form, Input, Space } from "antd";
import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  contactBaseFormSchema,
  emptyContactBaseFormValues,
  type ContactBaseFormValues,
} from "../model/contact-form";
import { ContactCreateOwnerSelect } from "./contact-create-owner-select";
import { ContactCreateTagSelect } from "./contact-create-tag-select";
import { ContactAddressFields } from "./contact-address-fields";

export function ContactBaseForm({
  checkingDuplicate = false,
  defaultValues = emptyContactBaseFormValues,
  disabled = false,
  formExtra,
  includeAddressFields = false,
  includeNextContactTime = false,
  includeOwnerSelection = false,
  includeTagSelection = false,
  onCancel,
  onCheckDuplicate,
  onSubmit,
  submitText,
  submitting,
}: Readonly<{
  checkingDuplicate?: boolean;
  defaultValues?: ContactBaseFormValues;
  disabled?: boolean;
  formExtra?: ReactNode;
  includeAddressFields?: boolean;
  includeNextContactTime?: boolean;
  includeOwnerSelection?: boolean;
  includeTagSelection?: boolean;
  onCancel(): void;
  onCheckDuplicate?(values: ContactBaseFormValues): void;
  onSubmit(values: ContactBaseFormValues): void;
  submitText: string;
  submitting: boolean;
}>) {
  const form = useForm<ContactBaseFormValues>({
    defaultValues,
    resolver: zodResolver(contactBaseFormSchema),
  });

  return (
    <Form layout="vertical" onFinish={form.handleSubmit((values) => onSubmit(values))}>
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <Form.Item
            help={fieldState.error?.message}
            label="联系人姓名"
            required
            validateStatus={fieldState.error ? "error" : undefined}
          >
            <Input
              {...field}
              autoFocus
              disabled={disabled}
              maxLength={200}
              placeholder="请输入联系人姓名"
            />
          </Form.Item>
        )}
      />
      <Controller
        control={form.control}
        name="jobTitle"
        render={({ field, fieldState }) => (
          <Form.Item
            help={fieldState.error?.message}
            label="职务"
            validateStatus={fieldState.error ? "error" : undefined}
          >
            <Input {...field} disabled={disabled} maxLength={200} placeholder="请输入职务" />
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
      {includeAddressFields ? (
        <ContactAddressFields control={form.control} disabled={disabled} />
      ) : null}
      {includeNextContactTime ? (
        <Controller
          control={form.control}
          name="nextContactTime"
          render={({ field, fieldState }) => (
            <Form.Item
              help={fieldState.error?.message}
              label="下次联系时间"
              validateStatus={fieldState.error ? "error" : undefined}
            >
              <Input {...field} disabled={disabled} type="datetime-local" />
            </Form.Item>
          )}
        />
      ) : null}
      <Controller
        control={form.control}
        name="description"
        render={({ field, fieldState }) => (
          <Form.Item
            help={fieldState.error?.message}
            label="说明"
            validateStatus={fieldState.error ? "error" : undefined}
          >
            <Input.TextArea {...field} disabled={disabled} maxLength={2000} rows={4} />
          </Form.Item>
        )}
      />
      {includeOwnerSelection ? (
        <ContactCreateOwnerSelect control={form.control} disabled={disabled} />
      ) : null}
      {includeTagSelection ? (
        <ContactCreateTagSelect control={form.control} disabled={disabled} />
      ) : null}
      {formExtra}
      <Space>
        <Button disabled={submitting} htmlType="button" onClick={onCancel}>
          取消
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
      </Space>
    </Form>
  );
}
