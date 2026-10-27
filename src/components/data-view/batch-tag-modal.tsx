import { Alert, Button, Form, Input, Modal, Typography } from "antd";
import { useState } from "react";

import {
  batchTagValidationError,
  parseBatchTagChange,
  type BatchTagChange,
} from "./batch-tag-change";

interface BatchTagModalProps {
  errorMessage?: string;
  objectLabel: string;
  open: boolean;
  pending: boolean;
  selectedCount: number;
  onCancel(): void;
  onSubmit(change: BatchTagChange): void;
}

export function BatchTagModal({ open, ...props }: Readonly<BatchTagModalProps>) {
  // Mounting only while visible gives every batch operation a clean draft without
  // needing an effect that synchronously resets state after the modal opens.
  return open ? <BatchTagModalContent {...props} /> : null;
}

function BatchTagModalContent({
  errorMessage,
  objectLabel,
  pending,
  selectedCount,
  onCancel,
  onSubmit,
}: Readonly<Omit<BatchTagModalProps, "open">>) {
  const [addedTags, setAddedTags] = useState("");
  const [removedTags, setRemovedTags] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  function submit() {
    const change = parseBatchTagChange(addedTags, removedTags);
    const nextValidationMessage = batchTagValidationError(change);
    setValidationMessage(nextValidationMessage);
    if (nextValidationMessage !== null || change === null) return;
    onSubmit(change);
  }

  return (
    <Modal
      destroyOnHidden
      footer={
        <>
          <Button disabled={pending} onClick={onCancel}>
            取消
          </Button>
          <Button loading={pending} type="primary" onClick={submit}>
            更新标签
          </Button>
        </>
      }
      open
      title={`批量编辑${objectLabel}标签`}
      onCancel={onCancel}
    >
      <Typography.Paragraph type="secondary">
        将对已选择的 {selectedCount} 个{objectLabel}
        同时应用标签变更。每行输入一个标签，也可使用逗号分隔。
      </Typography.Paragraph>
      <Form layout="vertical" onFinish={submit}>
        <Form.Item
          help={validationMessage ?? "留空表示不执行添加操作。"}
          label="添加标签"
          validateStatus={validationMessage ? "error" : undefined}
        >
          <Input.TextArea
            aria-invalid={validationMessage ? true : undefined}
            autoFocus
            placeholder="例如：重点客户, 待跟进"
            value={addedTags}
            onChange={(event) => {
              setAddedTags(event.target.value);
              setValidationMessage(null);
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
        </Form.Item>
        <Form.Item help="留空表示不执行移除操作。" label="移除标签">
          <Input.TextArea
            placeholder="例如：已归档"
            value={removedTags}
            onChange={(event) => {
              setRemovedTags(event.target.value);
              setValidationMessage(null);
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
        </Form.Item>
      </Form>
      {errorMessage ? <Alert title={errorMessage} showIcon type="error" /> : null}
    </Modal>
  );
}
