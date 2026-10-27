import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { useBootstrap } from "../bootstrap/bootstrap-context";
import { hasAuthority } from "./authority";

interface RouteAuthorityProps {
  authority?: string | null;
  children: ReactNode;
}

export function RouteAuthority({ authority, children }: Readonly<RouteAuthorityProps>) {
  const { authorization } = useBootstrap();
  return hasAuthority(authorization, authority) ? children : <Navigate replace to="/forbidden" />;
}
