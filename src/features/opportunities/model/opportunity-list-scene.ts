export type OpportunityListScene = "all" | "mine" | "starred" | "won" | "lost" | "invalid";

const outcomeByScene = {
  won: "WON",
  lost: "LOST",
  invalid: "INVALID",
} as const;

export function opportunityListSceneFromSearch(search: string): OpportunityListScene {
  const scene = new URLSearchParams(search).get("scene");
  return scene === "mine" ||
    scene === "starred" ||
    scene === "won" ||
    scene === "lost" ||
    scene === "invalid"
    ? scene
    : "all";
}

export function withOpportunityListScene<T extends object>(
  query: T,
  scene: OpportunityListScene,
  actorId: number | null | undefined,
): T & { outcome?: string; ownerActorId?: number; starred?: boolean } {
  const validActorId = typeof actorId === "number" && Number.isSafeInteger(actorId) && actorId > 0;
  if (scene === "mine" && validActorId) {
    return { ...query, ownerActorId: actorId };
  }
  if (scene === "starred") return { ...query, starred: true };
  if (scene === "won" || scene === "lost" || scene === "invalid") {
    return { ...query, outcome: outcomeByScene[scene] };
  }
  return query;
}
