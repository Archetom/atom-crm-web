import { Spin } from "antd";
import { Suspense } from "react";
import { Navigate, Outlet, useLocation } from "react-router";

import { useBootstrap } from "../bootstrap/bootstrap-context";
import { ResponsiveAppLayout } from "../layout/responsive-app-layout";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";

import styles from "./app-gate.module.css";

function LoadingScreen() {
  return (
    <main className={styles.loading} aria-live="polite" aria-label="正在加载应用">
      <Spin description="正在加载工作空间" size="large" />
    </main>
  );
}

export function AppGate() {
  const { error, reload, status } = useBootstrap();
  const location = useLocation();

  if (status === "loading") return <LoadingScreen />;

  if (status === "session-required") {
    return (
      <Navigate
        replace
        to={`/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
      />
    );
  }

  if (status === "error")
    return <StatusPage kind={statusKindFromError(error)} onRetry={() => void reload()} />;

  return (
    <ResponsiveAppLayout>
      <Suspense fallback={<LoadingScreen />}>
        <Outlet />
      </Suspense>
    </ResponsiveAppLayout>
  );
}
