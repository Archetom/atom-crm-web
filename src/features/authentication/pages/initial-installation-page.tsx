import {
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Result, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";

import { ApiError } from "~/api/errors/api-error";

import { authenticationApi } from "../api/authentication-api";

import styles from "./auth-page.module.css";
import { AuthenticationShell } from "./authentication-shell";

interface InstallationValues {
  displayName: string;
  email: string;
  loginName: string;
  password: string;
  passwordConfirmation: string;
}

/**
 * Ant Design derives both the label `htmlFor` and the control `id` from this form
 * name, so the two stay in sync. Passing an explicit `id` to a control would keep
 * the control's own value while the label still points at the generated one.
 */
const formName = "initial-installation";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export default function InitialInstallationPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<InstallationValues>();
  const firstInvalidField = useRef<keyof InstallationValues | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [installationCompletedElsewhere, setInstallationCompletedElsewhere] = useState(false);
  const [installationFinished, setInstallationFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    data: status,
    isError: statusFailed,
    isLoading: statusLoading,
    refetch,
  } = useQuery({
    queryFn: authenticationApi.getInitialInstallationStatus,
    queryKey: ["initial-installation-status"],
    retry: false,
  });

  const installationRequired = status?.installationRequired === true;
  const installationCompleted =
    installationCompletedElsewhere || (!statusLoading && !statusFailed && !installationRequired);

  if (installationCompleted) {
    return <Navigate replace to="/" />;
  }

  // Mirrors the login page: do not present an interactive form until the server has
  // confirmed whether installation is still available.
  if (statusLoading) {
    return (
      <AuthenticationShell>
        <Card className={styles.card}>
          <Typography.Text role="status" type="secondary">
            正在检查系统安装状态…
          </Typography.Text>
        </Card>
      </AuthenticationShell>
    );
  }

  async function submit(values: InstallationValues) {
    setSubmitting(true);
    setError(undefined);
    try {
      await authenticationApi.initializeTenantAdmin({
        displayName: values.displayName.trim(),
        email: values.email.trim(),
        loginName: values.loginName.trim(),
        password: values.password,
      });
      form.resetFields();
      setInstallationFinished(true);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        setInstallationCompletedElsewhere(true);
      } else {
        setError(errorMessage(reason, "创建初始管理员暂时无法完成，请稍后重试。"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function onFinishFailed() {
    const field = firstInvalidField.current;
    if (!field) return;
    document.getElementById(`${formName}_${field}`)?.focus();
  }

  function recordFirstInvalidField(errorFields: readonly { name: (string | number)[] }[]) {
    const first = errorFields[0]?.name[0];
    firstInvalidField.current =
      typeof first === "string" ? (first as keyof InstallationValues) : undefined;
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
        {installationFinished ? (
          <Result
            className={styles.success}
            extra={
              <Button
                className={styles.primaryAction}
                onClick={() => navigate("/", { replace: true })}
                type="primary"
              >
                进入工作空间
              </Button>
            }
            status="success"
            subTitle="初始管理员和工作区 1 已创建。当前浏览器已建立安全登录会话。"
            title="工作空间已初始化"
          />
        ) : statusFailed ? (
          <Result
            className={styles.success}
            extra={<Button onClick={() => void refetch()}>重新检查</Button>}
            status="warning"
            subTitle="暂时无法确认系统安装状态。请检查服务连接后重新检查。"
            title="无法读取安装状态"
          />
        ) : (
          <>
            <Typography.Title className={styles.heading} level={1}>
              初始化工作空间
            </Typography.Title>
            <Typography.Text className={styles.subtitle} type="secondary">
              仅在首次安装时可用。创建的账号将成为工作区 1 的所有者，可管理成员、权限与业务配置。
            </Typography.Text>
            <div className={styles.securityNotice} role="status">
              <SafetyCertificateOutlined aria-hidden />
              <span>请设置自己的管理员密码；系统不会提供或保留默认密码。</span>
            </div>
            {error ? <Alert className={styles.form} showIcon title={error} type="error" /> : null}
            <Form<InstallationValues>
              className={styles.form}
              form={form}
              layout="vertical"
              name={formName}
              onFinish={(values) => void submit(values)}
              onFinishFailed={({ errorFields }) => {
                recordFirstInvalidField(errorFields);
                onFinishFailed();
              }}
              requiredMark={false}
            >
              <Form.Item
                label="管理员姓名"
                name="displayName"
                rules={[
                  { required: true, message: "请输入管理员姓名" },
                  { max: 100, message: "管理员姓名不能超过 100 个字符" },
                ]}
              >
                <Input autoComplete="name" placeholder="例如 王小明" prefix={<UserOutlined />} />
              </Form.Item>
              <Form.Item
                label="登录账号"
                name="loginName"
                rules={[
                  { required: true, message: "请输入登录账号" },
                  {
                    pattern: /^[A-Za-z0-9_]{3,50}$/,
                    message: "请输入 3 至 50 位的字母、数字或下划线",
                  },
                ]}
              >
                <Input
                  autoComplete="username"
                  placeholder="例如 workspace_admin"
                  prefix={<UserOutlined />}
                  spellCheck={false}
                />
              </Form.Item>
              <Form.Item
                label="邮箱"
                name="email"
                rules={[
                  { required: true, message: "请输入管理员邮箱" },
                  { type: "email", message: "请输入有效的邮箱地址" },
                  { max: 254, message: "邮箱不能超过 254 个字符" },
                ]}
              >
                <Input
                  autoComplete="email"
                  placeholder="name@example.com"
                  prefix={<MailOutlined />}
                  type="email"
                />
              </Form.Item>
              <Form.Item
                label="设置密码"
                name="password"
                rules={[
                  { required: true, message: "请设置管理员密码" },
                  { min: 12, message: "请使用至少 12 个字符的密码" },
                  { max: 64, message: "密码不能超过 64 个字符" },
                ]}
              >
                <Input.Password
                  autoComplete="new-password"
                  placeholder="至少 12 个字符"
                  prefix={<LockOutlined />}
                />
              </Form.Item>
              <Form.Item
                dependencies={["password"]}
                label="确认密码"
                name="passwordConfirmation"
                rules={[
                  { required: true, message: "请再次输入密码" },
                  ({ getFieldValue }) => ({
                    validator(_, value: string | undefined) {
                      return value === getFieldValue("password")
                        ? Promise.resolve()
                        : Promise.reject(new Error("两次输入的密码不一致"));
                    },
                  }),
                ]}
              >
                <Input.Password
                  autoComplete="new-password"
                  placeholder="再次输入密码"
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
                创建管理员并进入系统
              </Button>
              <div className={styles.footer}>
                <Link to="/login">已有账号？前往登录</Link>
              </div>
            </Form>
          </>
        )}
      </Card>
    </AuthenticationShell>
  );
}
