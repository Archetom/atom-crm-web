import { createContext, useContext } from "react";

import type { ApiClient } from "~/api/client/api-client";
import type { MemberAuthorization, NavigationItem } from "~/shared/types/api";

export interface BootstrapContextValue {
  apiClient: ApiClient | null;
  authorization: MemberAuthorization | null;
  navigation: NavigationItem[];
  status: "loading" | "ready" | "session-required" | "error";
  error: unknown;
  reload(): Promise<void>;
}

export const BootstrapContext = createContext<BootstrapContextValue | null>(null);

export function useBootstrap(): BootstrapContextValue {
  const value = useContext(BootstrapContext);
  if (!value) throw new Error("useBootstrap must be used inside BootstrapProvider.");
  return value;
}
