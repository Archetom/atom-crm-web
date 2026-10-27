import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { createAppQueryClient } from "./query-client";
import { publicTheme } from "./theme";

/** Public routes deliberately omit AuthProvider and BootstrapProvider. */
export function PublicAppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(createAppQueryClient);

  return (
    <ConfigProvider locale={zhCN} theme={publicTheme}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ConfigProvider>
  );
}
