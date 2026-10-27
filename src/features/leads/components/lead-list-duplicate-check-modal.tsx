import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Form, Input, Modal, Space, Typography } from "antd";
import { Controller, useForm } from "react-hook-form";

import {
  emptyLeadListDuplicateCheckValues,
  leadListDuplicateCheckSchema,
  type LeadListDuplicateCheckValues,
} from "../model/lead-list-duplicate-check";

export function LeadListDuplicateCheckModal({
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
  onCheck(values: LeadListDuplicateCheckValues): void;
}>) {
  const form = useForm<LeadListDuplicateCheckValues>({
    defaultValues: emptyLeadListDuplicateCheckValues,
    resolver: zodResolver(leadListDuplicateCheckSchema),
  });

  function submit(values: LeadListDuplicateCheckValues) {
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
      title="线索查重"
      onCancel={onCancel}
    >
      <Form layout="vertical" onFinish={() => void form.handleSubmit(submit)()}>
        <Typography.Paragraph type="secondary">
          仅检查当前成员有权查看的线索范围，不返回匹配线索的资料。
        </Typography.Paragraph>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Form.Item
              help={fieldState.error?.message}
              label="线索名称"
              validateStatus={fieldState.error ? "error" : undefined}
            >
              <Input
                {...field}
                aria-label="线索名称"
                autoFocus
                disabled={pending}
                maxLength={200}
                placeholder="请输入线索名称"
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
            title={result ? "发现当前可见范围内存在重复线索。" : "当前可见范围内未发现重复线索。"}
            type={result ? "warning" : "success"}
          />
        )}
      </Form>
    </Modal>
  );
}
