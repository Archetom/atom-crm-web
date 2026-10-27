import { MailOutlined, SafetyCertificateOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Result, Typography } from "antd";
import { useState } from "react";
import { Link } from "react-router";

import { ApiError } from "~/api/errors/api-error";

import { authenticationApi } from "../api/authentication-api";

import styles from "./auth-page.module.css";
import { AuthenticationShell } from "./authentication-shell";
import { parsePositiveIntegerInput } from "~/shared/utils/route-params";

interface ResetRequestValues {
  loginName: string;
  tenantId: string;
}

export default function PasswordResetPage() {
  const [form] = Form.useForm<ResetRequestValues>();
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: ResetRequestValues) {
    const tenantId = parsePositiveIntegerInput(values.tenantId);
    if (!tenantId) {
      form.setFields([{ errors: ["租户 ID 必须是正整数"], name: "tenantId" }]);
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      await authenticationApi.requestPasswordReset({
        loginName: values.loginName.trim(),
        tenantId,
      });
      setSent(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "找回密码暂时无法提交，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthenticationShell>
      <Card className={styles.card}>
        <div className={styles.brand} aria-label="Atom CRM">
          <span aria-hidden className={styles.brandMark}>
            A
          </span>
          <Typography.Text strong>ATOM CRM</Typography.Text>
        </div>
        {sent ? (
          <Result
            className={styles.success}
            extra={<Link to="/login">返回登录</Link>}
            icon={<MailOutlined />}
            status="success"
            subTitle="如果租户和账号信息匹配，重置链接已发送到该账号绑定的邮箱。"
            title="请查收重置邮件"
          />
        ) : (
          <>
            <Typography.Title className={styles.heading} level={1}>
              找回密码
            </Typography.Title>
            <Typography.Text className={styles.subtitle} type="secondary">
              输入账号所属的工作区 ID 和登录账号。为保护账号安全，页面不会提示账号是否存在。
            </Typography.Text>
            {error ? <Alert className={styles.form} showIcon title={error} type="error" /> : null}
            <Form<ResetRequestValues>
              className={styles.form}
              form={form}
              layout="vertical"
              onFinish={(values) => void submit(values)}
              requiredMark={false}
            >
              <Form.Item
                label="工作区 ID"
                name="tenantId"
                rules={[{ required: true, message: "请输入工作区 ID" }]}
              >
                <Input
                  autoComplete="organization"
                  inputMode="numeric"
                  placeholder="例如 900001"
                  prefix={<SafetyCertificateOutlined />}
                />
              </Form.Item>
              <p className={styles.fieldHint}>请使用管理员或邀请邮件提供的工作区编号。</p>
              <Form.Item
                label="登录账号"
                name="loginName"
                rules={[
                  { required: true, message: "请输入登录账号" },
                  { pattern: /^[A-Za-z0-9_]{3,50}$/, message: "请输入 3 至 50 位的有效登录账号" },
                ]}
              >
                <Input
                  autoComplete="username"
                  placeholder="请输入账号"
                  prefix={<UserOutlined />}
                  spellCheck={false}
                />
              </Form.Item>
              <Button
                block
                className={styles.primaryAction}
                htmlType="submit"
                loading={submitting}
                size="large"
                type="primary"
              >
                发送重置链接
              </Button>
              <div className={styles.footer}>
                <Link to="/login">返回登录</Link>
              </div>
            </Form>
          </>
        )}
      </Card>
    </AuthenticationShell>
  );
}
