import { LockOutlined, SafetyCertificateOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Radio, Space, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import type { components } from "~/api/generated/schema";
import { isDevAuthEnabled } from "~/app/auth/dev-auth";

import { authenticationApi } from "../api/authentication-api";

import styles from "./auth-page.module.css";
import { AuthenticationShell } from "./authentication-shell";
import { parsePositiveIntegerInput } from "~/shared/utils/route-params";

interface LoginValues {
  loginName: string;
  password: string;
  tenantId: string;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function returnPath(search: string): string {
  const next = new URLSearchParams(search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginValues>();
  const [challenge, setChallenge] = useState<string>();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState<
    readonly components["schemas"]["PasswordLoginTenantResponse"][]
  >([]);
  const [selectedTenant, setSelectedTenant] = useState<number>();
  const [sourceTenantId, setSourceTenantId] = useState<number>();
  const { data: installationStatus, isLoading: installationStatusLoading } = useQuery({
    queryFn: authenticationApi.getInitialInstallationStatus,
    queryKey: ["initial-installation-status"],
    retry: false,
  });

  const selectingTenant = challenge !== undefined;
  const developmentIdentityAvailable = import.meta.env.DEV && isDevAuthEnabled();

  if (installationStatus?.installationRequired) {
    return <Navigate replace to="/setup" />;
  }

  if (installationStatusLoading) {
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

  async function verifyCredentials(values: LoginValues) {
    const tenantId = parsePositiveIntegerInput(values.tenantId);
    if (!tenantId) {
      form.setFields([{ errors: ["租户 ID 必须是正整数"], name: "tenantId" }]);
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const response = await authenticationApi.beginPasswordLogin({
        loginName: values.loginName.trim(),
        password: values.password,
        tenantId,
      });
      if (!response.loginChallenge || response.tenants.length === 0) {
        throw new Error("没有可进入的租户，请联系管理员检查成员资格。");
      }
      setChallenge(response.loginChallenge);
      setTenants(response.tenants);
      setSelectedTenant(response.tenants[0]?.tenantId);
      setSourceTenantId(tenantId);
      form.setFieldValue("password", "");
    } catch (reason) {
      setError(errorMessage(reason, "登录验证暂时无法完成，请稍后重试。"));
    } finally {
      setSubmitting(false);
    }
  }

  async function enterWorkspace() {
    if (!challenge || !selectedTenant) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await authenticationApi.createPasswordSession({
        loginChallenge: challenge,
        tenantId: selectedTenant,
      });
      navigate(returnPath(location.search), { replace: true });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setChallenge(undefined);
        setTenants([]);
        setSelectedTenant(undefined);
        setSourceTenantId(undefined);
        setError("工作区选择已失效，请重新验证账号和密码。");
      } else {
        setError(errorMessage(reason, "建立登录会话暂时无法完成，请重新验证账号密码。"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function backToCredentials() {
    setChallenge(undefined);
    setTenants([]);
    setSelectedTenant(undefined);
    setSourceTenantId(undefined);
    setError(undefined);
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
        <Typography.Title className={styles.heading} level={1}>
          {selectingTenant ? "选择要进入的工作区" : "登录工作空间"}
        </Typography.Title>
        <Typography.Text className={styles.subtitle} type="secondary">
          {selectingTenant
            ? "账号已验证。请选择本次要进入的已授权工作区。"
            : "使用工作区 ID、登录账号和密码安全进入业务工作空间。"}
        </Typography.Text>

        {error ? <Alert className={styles.form} showIcon title={error} type="error" /> : null}

        {selectingTenant ? (
          <section
            className={styles.form}
            aria-busy={submitting}
            aria-labelledby="tenant-selection-title"
          >
            <div className={styles.steps} aria-label="登录进度">
              <div className={styles.step}>
                <span className={styles.stepNumber}>1</span>
                验证账号
              </div>
              <div className={`${styles.step} ${styles.stepActive}`}>
                <span className={styles.stepNumber}>2</span>
                选择工作区
              </div>
            </div>
            <Typography.Title id="tenant-selection-title" level={4}>
              选择工作区
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              仅展示本次验证后服务端确认的有效成员工作区。
            </Typography.Paragraph>
            <Radio.Group
              aria-label="选择工作区"
              className={styles.tenantList}
              onChange={(event) => setSelectedTenant(event.target.value)}
              value={selectedTenant}
            >
              <Space orientation="vertical" style={{ display: "flex" }}>
                {tenants.map((tenant) => (
                  <Radio key={tenant.tenantId} value={tenant.tenantId}>
                    <span className={styles.tenantOption}>
                      <Typography.Text strong>工作区 {tenant.tenantId}</Typography.Text>
                      <Typography.Text type="secondary">
                        {tenant.tenantId === sourceTenantId
                          ? "本次验证工作区"
                          : tenant.departmentId
                            ? `默认部门 ${tenant.departmentId}`
                            : "可直接进入"}
                      </Typography.Text>
                    </span>
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
            <Space className={styles.footer} style={{ display: "flex" }}>
              <Button disabled={submitting} htmlType="button" onClick={backToCredentials}>
                返回
              </Button>
              <Button
                className={styles.primaryAction}
                disabled={!selectedTenant}
                htmlType="button"
                loading={submitting}
                onClick={() => void enterWorkspace()}
                type="primary"
              >
                进入工作空间
              </Button>
            </Space>
          </section>
        ) : (
          <Form<LoginValues>
            className={styles.form}
            form={form}
            layout="vertical"
            onFinish={(values) => void verifyCredentials(values)}
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
                { max: 50, message: "登录账号不能超过 50 个字符" },
                { min: 3, message: "登录账号至少 3 个字符" },
                { pattern: /^[A-Za-z0-9_]+$/, message: "登录账号只能使用字母、数字或下划线" },
              ]}
            >
              <Input
                autoComplete="username"
                placeholder="请输入账号"
                prefix={<UserOutlined />}
                spellCheck={false}
              />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password
                autoComplete="current-password"
                placeholder="请输入密码"
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
              验证并选择工作区
            </Button>
            <div className={styles.formFooter}>
              <Link to="/password-reset">忘记密码？</Link>
              <Link className={styles.mutedLink} to="/setup">
                首次安装？创建管理员
              </Link>
              {developmentIdentityAvailable ? (
                <Link className={styles.mutedLink} to="/dev/session">
                  使用本地开发身份
                </Link>
              ) : null}
            </div>
          </Form>
        )}
      </Card>
    </AuthenticationShell>
  );
}
