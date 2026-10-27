export type LeadListScene = "unconverted" | "mine" | "subordinates" | "converted" | "starred";

export function leadListSceneFromSearch(search: string): LeadListScene {
  const scene = new URLSearchParams(search).get("scene");
  return scene === "mine" ||
    scene === "subordinates" ||
    scene === "converted" ||
    scene === "starred"
    ? scene
    : "unconverted";
}

export function withLeadListScene<T extends object>(
  query: T,
  scene: LeadListScene,
  actorId: number | null | undefined,
): T & {
  ownerActorId?: number;
  subordinateOwnerOnly?: boolean;
  starred?: boolean;
  converted?: boolean;
} {
  const validActorId = typeof actorId === "number" && Number.isSafeInteger(actorId) && actorId > 0;
  if (scene === "mine" && validActorId) {
    return { ...query, ownerActorId: actorId, converted: false };
  }
  if (scene === "subordinates") return { ...query, subordinateOwnerOnly: true, converted: false };
  if (scene === "starred") return { ...query, starred: true };
  if (scene === "converted") return { ...query, converted: true };
  return { ...query, converted: false };
}
