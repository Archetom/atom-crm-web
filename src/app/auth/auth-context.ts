import { createContext, useContext } from "react";

import type { AuthAdapter, AuthBootstrapState } from "./auth-adapter";

export interface AuthContextValue {
  adapter: AuthAdapter | null;
  state: AuthBootstrapState | null;
  status: "loading" | "ready" | "session-required" | "error";
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
