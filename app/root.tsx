import type { ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteError,
} from "react-router";

import { AppProviders } from "~/app/providers/app-providers";
import { AppGate } from "~/app/providers/app-gate";
import { PublicAppProviders } from "~/app/providers/public-app-providers";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";
import "~/styles/global.css";

export function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        {/* `viewport-fit=cover` is required for `env(safe-area-inset-*)` to resolve to a
            non-zero value on notched devices; without it the mobile action bars and the
            navigation drawer sit under the home indicator. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Atom CRM</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const publicRoute =
    pathname.startsWith("/public/marketing-forms/") ||
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname === "/password-reset" ||
    pathname === "/password-reset/confirm" ||
    (import.meta.env.DEV && pathname === "/dev/session");
  if (publicRoute) {
    return (
      <PublicAppProviders>
        <Outlet />
      </PublicAppProviders>
    );
  }

  return (
    <AppProviders>
      <AppGate />
    </AppProviders>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return <StatusPage kind={statusKindFromError(error)} />;
}
