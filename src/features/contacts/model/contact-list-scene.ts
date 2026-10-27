export type ContactListScene = "all" | "mine" | "subordinates" | "starred";

export function contactListSceneFromSearch(search: string): ContactListScene {
  const scene = new URLSearchParams(search).get("scene");
  return scene === "mine" || scene === "subordinates" || scene === "starred" ? scene : "all";
}

export function withContactListScene<T extends object>(
  query: T,
  scene: ContactListScene,
  actorId: number | null | undefined,
): T & { ownerActorId?: number; subordinateOwnerOnly?: boolean; starred?: boolean } {
  const validActorId = typeof actorId === "number" && Number.isSafeInteger(actorId) && actorId > 0;
  if (scene === "mine" && validActorId) return { ...query, ownerActorId: actorId };
  if (scene === "subordinates") return { ...query, subordinateOwnerOnly: true };
  return scene === "starred" ? { ...query, starred: true } : query;
}
