import { Form, Input } from "antd";
import { Controller, type Control } from "react-hook-form";

import type { ContactBaseFormValues } from "../model/contact-form";

/** Collects one explicit primary address without inferring regional values. */
export function ContactAddressFields({
  control,
  disabled,
}: Readonly<{
  control: Control<ContactBaseFormValues>;
  disabled: boolean;
}>) {
  return (
    <>
      <Controller
        control={control}
        name="addressLine"
        render={({ field, fieldState }) => (
          <Form.Item
            help={fieldState.error?.message}
            label="详细地址"
            validateStatus={fieldState.error ? "error" : undefined}
          >
            <Input
              {...field}
              aria-label="详细地址"
              autoComplete="street-address"
              disabled={disabled}
              maxLength={500}
              placeholder="请输入详细地址"
            />
          </Form.Item>
        )}
      />
      <Controller
        control={control}
        name="addressRegion"
        render={({ field, fieldState }) => (
          <Form.Item
            help={fieldState.error?.message}
            label="地区"
            validateStatus={fieldState.error ? "error" : undefined}
          >
            <Input
              {...field}
              aria-label="地区"
              autoComplete="address-level1"
              disabled={disabled}
              maxLength={100}
              placeholder="例如 上海市"
            />
          </Form.Item>
        )}
      />
      <Controller
        control={control}
        name="addressCity"
        render={({ field, fieldState }) => (
          <Form.Item
            help={fieldState.error?.message}
            label="城市"
            validateStatus={fieldState.error ? "error" : undefined}
          >
            <Input
              {...field}
              aria-label="城市"
              autoComplete="address-level2"
              disabled={disabled}
              maxLength={100}
              placeholder="例如 上海"
            />
          </Form.Item>
        )}
      />
      <Controller
        control={control}
        name="addressPostalCode"
        render={({ field, fieldState }) => (
          <Form.Item
            extra="填写地区、城市或邮编时，需同时填写详细地址。"
            help={fieldState.error?.message}
            label="邮编"
            validateStatus={fieldState.error ? "error" : undefined}
          >
            <Input
              {...field}
              aria-label="邮编"
              autoComplete="postal-code"
              disabled={disabled}
              maxLength={30}
              placeholder="请输入邮编"
            />
          </Form.Item>
        )}
      />
    </>
  );
}
