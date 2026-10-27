export type CustomerListScene = "all" | "mine" | "subordinates" | "starred";

export interface CustomerListSceneQuery {
  ownerActorId?: number;
  subordinateOwnerOnly?: boolean;
  starred?: boolean;
}

export function customerListSceneFromSearch(search: string): CustomerListScene {
  const scene = new URLSearchParams(search).get("scene");
  return scene === "mine" || scene === "subordinates" || scene === "starred" ? scene : "all";
}

export function withCustomerListScene<T extends object>(
  query: T,
  scene: CustomerListScene,
  actorId: number | null | undefined,
): T & CustomerListSceneQuery {
  if (scene === "mine" && actorId !== null && actorId !== undefined && actorId > 0) {
    return { ...query, ownerActorId: actorId };
  }
  if (scene === "subordinates") return { ...query, subordinateOwnerOnly: true };
  if (scene === "starred") return { ...query, starred: true };
  return { ...query };
}
