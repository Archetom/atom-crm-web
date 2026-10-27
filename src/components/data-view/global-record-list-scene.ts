import type { components } from "~/api/generated/schema";
import type { EntityQueryValue } from "~/api/query-keys/entity";

export interface GlobalRecordListQuery extends Readonly<Record<string, EntityQueryValue>> {
  conditions?: components["schemas"]["FilterConditionRequest"][];
  page: number;
  size: number;
  contractId?: number;
  customerId?: number;
  keyword?: string;
  ownerActorId?: number;
  opportunityId?: number;
  receivablePlanId?: number;
  savedViewId?: number;
  status?: string;
  subordinateOwnerOnly?: boolean;
}

export type GlobalRecordListScene = "all" | "mine" | "subordinates";

export interface GlobalRecordListStatusOption {
  label: string;
  value: string;
}

export function globalRecordListSceneFromSearch(
  search: string,
  supportsMine: boolean,
  supportsSubordinates = false,
): GlobalRecordListScene {
  const scene = new URLSearchParams(search).get("scene");
  if (supportsMine && scene === "mine") return "mine";
  return supportsSubordinates && scene === "subordinates" ? "subordinates" : "all";
}

/**
 * Keeps a URL status only when the current surface explicitly publishes that
 * value. This prevents a hand-edited URL from turning into an arbitrary server
 * enum request.
 */
export function globalRecordListStatusFromSearch(
  search: string,
  options: readonly GlobalRecordListStatusOption[],
): string | undefined {
  const status = new URLSearchParams(search).get("status");
  return options.some((option) => option.value === status) ? (status ?? undefined) : undefined;
}

/**
 * Restores a relation filter only when its URL value is an exact, positive
 * safe integer. This keeps hand-edited search parameters out of typed API
 * requests until the caller has a server-visible entity confirmation.
 */
export function globalRecordListPositiveIdFromSearch(
  search: string,
  parameter: string,
): number | undefined {
  const raw = new URLSearchParams(search).get(parameter);
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return undefined;

  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/** Sends a relation ID only after the same server response confirms that exact entity. */
export function globalRecordListConfirmedRelationId(
  requestedId: number | undefined,
  confirmedId: number | undefined,
): number | undefined {
  return requestedId !== undefined && requestedId === confirmedId ? requestedId : undefined;
}

export function withGlobalRecordListScene<T extends GlobalRecordListQuery>(
  query: T,
  scene: GlobalRecordListScene,
  actorId: number | null | undefined,
): T & { ownerActorId?: number; subordinateOwnerOnly?: boolean } {
  const validActorId = typeof actorId === "number" && Number.isSafeInteger(actorId) && actorId > 0;
  if (scene === "mine" && validActorId) return { ...query, ownerActorId: actorId };
  return scene === "subordinates" ? { ...query, subordinateOwnerOnly: true } : query;
}
