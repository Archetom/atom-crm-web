import { Alert } from "antd";
import type { ReactNode } from "react";

import styles from "./data-workspace.module.css";

interface DataWorkspaceProps {
  children: ReactNode;
  errorMessage?: string;
  label: string;
}

export function DataWorkspace({ children, errorMessage, label }: Readonly<DataWorkspaceProps>) {
  return (
    <section aria-label={label} className={styles.root}>
      {errorMessage ? <Alert title={errorMessage} showIcon type="error" /> : null}
      {children}
    </section>
  );
}
