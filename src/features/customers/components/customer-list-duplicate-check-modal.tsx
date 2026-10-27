import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Form, Input, Modal, Space, Typography } from "antd";
import { Controller, useForm } from "react-hook-form";

import {
  customerListDuplicateCheckSchema,
  emptyCustomerListDuplicateCheckValues,
  type CustomerListDuplicateCheckValues,
} from "../model/customer-list-duplicate-check";

export function CustomerListDuplicateCheckModal({
  errorMessage,
  open,
  pending,
  result,
  onCancel,
  onCheck,
}: Readonly<{
  errorMessage?: string;
  open: boolean;
  pending: boolean;
  result?: boolean;
  onCancel(): void;
  onCheck(values: CustomerListDuplicateCheckValues): void;
}>) {
  const form = useForm<CustomerListDuplicateCheckValues>({
    defaultValues: emptyCustomerListDuplicateCheckValues,
    resolver: zodResolver(customerListDuplicateCheckSchema),
  });

  function submit(values: CustomerListDuplicateCheckValues) {
    onCheck(values);
  }

  return (
    <Modal
      closable={!pending}
      destroyOnHidden
      footer={
        <Space>
          <Button disabled={pending} onClick={onCancel}>
            取消
          </Button>
          <Button
            htmlType="button"
            loading={pending}
            type="primary"
            onClick={() => void form.handleSubmit(submit)()}
          >
            查重
          </Button>
        </Space>
      }
      keyboard={!pending}
      open={open}
      title="客户查重"
      onCancel={onCancel}
    >
      <Form layout="vertical" onFinish={() => void form.handleSubmit(submit)()}>
        <Typography.Paragraph type="secondary">
          仅检查当前成员有权查看的客户范围，不返回匹配客户的资料。
        </Typography.Paragraph>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Form.Item
              help={fieldState.error?.message}
              label="客户名称"
              validateStatus={fieldState.error ? "error" : undefined}
            >
              <Input
                {...field}
                aria-label="客户名称"
                autoFocus
                disabled={pending}
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
                aria-label="联系电话"
                disabled={pending}
                inputMode="tel"
                maxLength={16}
                placeholder="例如 +8613812345678"
              />
            </Form.Item>
          )}
        />
        {errorMessage ? <Alert showIcon title={errorMessage} type="error" /> : null}
        {result === undefined ? null : (
          <Alert
            description="这是当前输入的最近一次检查结果；后续创建或编辑仍由服务端最终校验。"
            showIcon
            title={result ? "发现当前可见范围内存在重复客户。" : "当前可见范围内未发现重复客户。"}
            type={result ? "warning" : "success"}
          />
        )}
      </Form>
    </Modal>
  );
}
