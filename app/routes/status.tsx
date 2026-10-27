import { useLocation } from "react-router";

import { StatusPage } from "~/components/feedback/status-page";
import type { StatusKind } from "~/components/feedback/status-kind";

const kinds: Record<string, StatusKind> = {
  "/unauthorized": "unauthorized",
  "/forbidden": "forbidden",
  "/not-found": "not-found",
  "/conflict": "conflict",
  "/unavailable": "unavailable",
};

export default function StatusRoute() {
  const { pathname } = useLocation();
  return <StatusPage kind={kinds[pathname] ?? "not-found"} />;
}
