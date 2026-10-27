import { LockOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Result, Typography } from "antd";
import { useState } from "react";
import { Link, useLocation } from "react-router";

import { ApiError } from "~/api/errors/api-error";

import { authenticationApi } from "../api/authentication-api";

import styles from "./auth-page.module.css";
import { AuthenticationShell } from "./authentication-shell";

interface ResetConfirmValues {
  confirmPassword: string;
  newPassword: string;
}

export default function PasswordResetConfirmPage() {
  const location = useLocation();
  const [form] = Form.useForm<ResetConfirmValues>();
  const [error, setError] = useState<string>();
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const resetToken = new URLSearchParams(location.search).get("token")?.trim();

  async function submit(values: ResetConfirmValues) {
    if (!resetToken) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await authenticationApi.confirmPasswordReset({ newPassword: values.newPassword, resetToken });
      setCompleted(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "密码重置暂时无法完成，请稍后重试。");
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
        {completed ? (
          <Result
            className={styles.success}
            extra={<Link to="/login">使用新密码登录</Link>}
            status="success"
            subTitle="此前的浏览器登录状态已失效，请使用新密码重新登录。"
            title="密码已更新"
          />
        ) : !resetToken ? (
          <Result
            className={styles.success}
            extra={<Link to="/password-reset">重新申请重置链接</Link>}
            status="error"
            subTitle="请使用邮件中的完整链接，或重新申请一封重置邮件。"
            title="重置链接无效"
          />
        ) : (
          <>
            <Typography.Title className={styles.heading} level={1}>
              设置新密码
            </Typography.Title>
            <Typography.Text className={styles.subtitle} type="secondary">
              新密码需要 12 至 64 个字符。完成后请使用新密码重新登录。
            </Typography.Text>
            {error ? <Alert className={styles.form} showIcon title={error} type="error" /> : null}
            <Form<ResetConfirmValues>
              className={styles.form}
              form={form}
              layout="vertical"
              onFinish={(values) => void submit(values)}
              requiredMark={false}
            >
              <Form.Item
                label="新密码"
                name="newPassword"
                rules={[
                  { required: true, message: "请输入新密码" },
                  { min: 12, message: "新密码至少需要 12 个字符" },
                  { max: 64, message: "新密码不能超过 64 个字符" },
                ]}
              >
                <Input.Password
                  autoComplete="new-password"
                  placeholder="设置新密码"
                  prefix={<LockOutlined />}
                />
              </Form.Item>
              <Form.Item
                dependencies={["newPassword"]}
                label="确认新密码"
                name="confirmPassword"
                rules={[
                  { required: true, message: "请再次输入新密码" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return !value || getFieldValue("newPassword") === value
                        ? Promise.resolve()
                        : Promise.reject(new Error("两次输入的密码不一致"));
                    },
                  }),
                ]}
              >
                <Input.Password
                  autoComplete="new-password"
                  placeholder="再次输入新密码"
                  prefix={<LockOutlined />}
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
                更新密码
              </Button>
            </Form>
          </>
        )}
      </Card>
    </AuthenticationShell>
  );
}
