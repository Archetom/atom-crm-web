import type { ReactNode } from "react";

import styles from "./form-workspace.module.css";

interface FormWorkspaceProps {
  children: ReactNode;
  footer: ReactNode;
  label: string;
}

export function FormWorkspace({ children, footer, label }: Readonly<FormWorkspaceProps>) {
  return (
    <section aria-label={label} className={styles.root}>
      <div className={styles.fields}>{children}</div>
      <footer className={styles.footer}>{footer}</footer>
    </section>
  );
}
