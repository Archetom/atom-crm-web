import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict } from "~/api/errors/mutation-conflict";

export type StatusKind =
  "unauthorized" | "forbidden" | "not-found" | "conflict" | "duplicate-resource" | "unavailable";

export function statusKindFromError(error: unknown): StatusKind {
  if (!(error instanceof ApiError)) return "unavailable";
  if (error.status === 401) return "unauthorized";
  if (error.status === 403) return "forbidden";
  if (error.status === 404) return "not-found";
  const conflict = getMutationConflict(error);
  if (conflict?.kind === "resource-already-exists") return "duplicate-resource";
  if (conflict !== null) return "conflict";
  return "unavailable";
}
