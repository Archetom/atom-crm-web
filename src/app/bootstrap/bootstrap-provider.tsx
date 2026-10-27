import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { createApiClient } from "~/api/client/api-client";
import { bootstrapKeys } from "~/api/query-keys/bootstrap";

import { useAuth } from "../auth/auth-context";
import { BootstrapContext, type BootstrapContextValue } from "./bootstrap-context";

export function BootstrapProvider({ children }: Readonly<{ children: ReactNode }>) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const identityKey = auth.state?.identityKey ?? "pending";
  const activeIdentityKey = useRef<string | null>(null);
  const apiClient = useMemo(
    () => (auth.adapter ? createApiClient(auth.adapter) : null),
    [auth.adapter],
  );
  const enabled = auth.status === "ready" && apiClient !== null;

  useEffect(() => {
    if (!enabled) return;
    if (activeIdentityKey.current === null) {
      activeIdentityKey.current = identityKey;
      return;
    }
    if (activeIdentityKey.current === identityKey) return;

    activeIdentityKey.current = identityKey;
    queryClient.clear();
  }, [enabled, identityKey, queryClient]);

  const authorizationQuery = useQuery({
    queryKey: bootstrapKeys.authorization(identityKey),
    queryFn: () =>
      apiClient?.getAuthorization() ?? Promise.reject(new Error("API client is unavailable.")),
    enabled,
    retry: false,
  });
  const navigationQuery = useQuery({
    queryKey: bootstrapKeys.navigation(identityKey),
    queryFn: () =>
      apiClient?.getNavigation() ?? Promise.reject(new Error("API client is unavailable.")),
    enabled,
    retry: false,
  });

  const ready =
    enabled && authorizationQuery.data !== undefined && navigationQuery.data !== undefined;
  const error = authorizationQuery.error ?? navigationQuery.error;
  const status: BootstrapContextValue["status"] =
    auth.status === "loading"
      ? "loading"
      : auth.status === "session-required"
        ? "session-required"
        : auth.status === "error" || error
          ? "error"
          : ready
            ? "ready"
            : "loading";

  const value: BootstrapContextValue = {
    apiClient,
    authorization: authorizationQuery.data ?? null,
    navigation: navigationQuery.data ?? [],
    status,
    error,
    async reload() {
      await Promise.all([authorizationQuery.refetch(), navigationQuery.refetch()]);
    },
  };

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}
