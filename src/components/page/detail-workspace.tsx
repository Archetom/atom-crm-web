import type { ReactNode } from "react";

import styles from "./detail-workspace.module.css";

interface DetailWorkspaceProps {
  children: ReactNode;
  header: ReactNode;
  summary?: ReactNode;
}

export function DetailWorkspace({ children, header, summary }: Readonly<DetailWorkspaceProps>) {
  return (
    <div className={styles.root}>
      {header}
      <div className={styles.body}>
        <div className={styles.content}>{children}</div>
        {summary ? (
          <aside aria-label="业务摘要" className={styles.summary}>
            {summary}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
