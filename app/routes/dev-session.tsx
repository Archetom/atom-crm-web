import { Alert, Button, Card, Form, Input, Result, Space, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";

import {
  clearDevSession,
  isDevAuthEnabled,
  readDevSession,
  saveDevSession,
} from "~/app/auth/dev-auth";

interface DevSessionForm {
  actorId: string;
  tenantId: string;
}

function toPositiveSafeInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && String(parsed) === value.trim()
    ? parsed
    : null;
}

export default function DevSessionRoute() {
  const location = useLocation();
  const [form] = Form.useForm<DevSessionForm>();
  const [submitting, setSubmitting] = useState(false);
  const enabled = isDevAuthEnabled();

  useEffect(() => {
    if (new URLSearchParams(location.search).has("reset")) clearDevSession();
    const session = readDevSession();
    if (session)
      form.setFieldsValue({ actorId: String(session.actorId), tenantId: String(session.tenantId) });
  }, [form, location.search]);

  async function submit(values: DevSessionForm) {
    const actorId = toPositiveSafeInteger(values.actorId);
    const tenantId = toPositiveSafeInteger(values.tenantId);
    if (!actorId || !tenantId) {
      message.error("成员 ID 和租户 ID 必须是正整数。");
      return;
    }

    setSubmitting(true);
    saveDevSession({ actorId, tenantId });
    window.location.assign("/");
  }

  if (!enabled) {
    return (
      <Result
        status="info"
        title="开发身份未启用"
        subTitle="仅本地开发可启用开发身份；生产构建会拒绝该配置。"
        extra={<Typography.Text code>VITE_ENABLE_DEV_AUTH=true</Typography.Text>}
      />
    );
  }

  return (
    <main className="session-page">
      <Card className="session-card">
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <section>
            <Typography.Title level={2}>开发身份</Typography.Title>
            <Typography.Paragraph type="secondary">
              身份仅保存在当前浏览器标签页的 sessionStorage，并仅在 Vite 开发模式下作为请求 Header
              使用。
            </Typography.Paragraph>
          </section>
          <Alert
            showIcon
            title="不得填入真实生产身份"
            description="生产构建不包含开发 Header。这里的 ID 必须来自本地 dev/test 租户。"
            type="warning"
          />
          <Form<DevSessionForm>
            form={form}
            layout="vertical"
            onFinish={(values) => void submit(values)}
          >
            <Form.Item
              label="成员 ID"
              name="actorId"
              rules={[{ required: true, message: "请输入成员 ID" }]}
            >
              <Input inputMode="numeric" placeholder="例如 900001" />
            </Form.Item>
            <Form.Item
              label="租户 ID"
              name="tenantId"
              rules={[{ required: true, message: "请输入租户 ID" }]}
            >
              <Input inputMode="numeric" placeholder="例如 900001" />
            </Form.Item>
            <Button block htmlType="submit" loading={submitting} type="primary">
              进入开发工作空间
            </Button>
          </Form>
        </Space>
      </Card>
    </main>
  );
}
