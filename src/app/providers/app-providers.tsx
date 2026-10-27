import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { AuthProvider } from "../auth/auth-provider";
import { BootstrapProvider } from "../bootstrap/bootstrap-provider";

import { createAppQueryClient } from "./query-client";
import { appTheme } from "./theme";

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(createAppQueryClient);

  return (
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BootstrapProvider>{children}</BootstrapProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
