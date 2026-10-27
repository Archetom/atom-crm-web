import type { ReactNode } from "react";

import { useBootstrap } from "../bootstrap/bootstrap-context";
import { hasAuthority } from "./authority";

interface ActionAuthorityProps {
  authority: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ActionAuthority({
  authority,
  children,
  fallback = null,
}: Readonly<ActionAuthorityProps>) {
  const { authorization } = useBootstrap();
  return hasAuthority(authorization, authority) ? children : fallback;
}
