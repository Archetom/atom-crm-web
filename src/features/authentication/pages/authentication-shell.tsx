import { LockOutlined, SafetyCertificateOutlined, TeamOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";

import styles from "./auth-page.module.css";

interface AuthenticationShellProps {
  children: ReactNode;
}

/** Shared public shell for password login and recovery without loading application identity state. */
export function AuthenticationShell({ children }: Readonly<AuthenticationShellProps>) {
  return (
    <main className={styles.page} id="main-content">
      <section className={styles.content}>{children}</section>
      <aside className={styles.introduction} aria-labelledby="authentication-introduction-title">
        <div className={styles.introductionBrand} aria-label="Atom CRM">
          <span aria-hidden className={styles.brandMark}>
            A
          </span>
          <span className={styles.brandName}>ATOM CRM</span>
        </div>
        <p className={styles.eyebrow}>团队业务工作空间</p>
        <h2 id="authentication-introduction-title" className={styles.introductionTitle}>
          让每一次客户协作，都在正确的工作区完成。
        </h2>
        <p className={styles.introductionDescription}>
          使用由管理员或邀请邮件提供的工作区 ID 登录。验证完成后，再选择本次需要进入的已授权工作区。
        </p>
        <ul className={styles.benefits}>
          <li>
            <SafetyCertificateOutlined aria-hidden />
            <span>登录会话仅保留在受保护的浏览器 Cookie 中。</span>
          </li>
          <li>
            <TeamOutlined aria-hidden />
            <span>一个账号可按已授权成员资格进入多个工作区。</span>
          </li>
          <li>
            <LockOutlined aria-hidden />
            <span>密码重置链接一次有效，完成后旧会话会自动失效。</span>
          </li>
        </ul>
      </aside>
    </main>
  );
}
