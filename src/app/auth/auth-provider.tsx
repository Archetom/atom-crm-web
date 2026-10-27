import { useEffect, useState, type ReactNode } from "react";

import { createAuthAdapter } from "./auth-adapter";
import { AuthContext, type AuthContextValue } from "./auth-context";

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [value, setValue] = useState<AuthContextValue>({
    adapter: null,
    state: null,
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    void createAuthAdapter()
      .then(async (adapter) => ({ adapter, state: await adapter.bootstrap() }))
      .then(({ adapter, state }) => {
        if (cancelled) return;

        setValue({
          adapter,
          state,
          status: state.ready ? "ready" : "session-required",
        });
      })
      .catch(() => {
        if (!cancelled) setValue({ adapter: null, state: null, status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
