export type ProductListScene = "all" | "available" | "unavailable";

const availabilityByScene = {
  available: "AVAILABLE",
  unavailable: "UNAVAILABLE",
} as const;

export function productListSceneFromSearch(search: string): ProductListScene {
  const scene = new URLSearchParams(search).get("scene");
  return scene === "available" || scene === "unavailable" ? scene : "all";
}

export function withProductListScene<T extends object>(
  query: T,
  scene: ProductListScene,
): T & { availability?: string } {
  return scene === "all" ? query : { ...query, availability: availabilityByScene[scene] };
}
