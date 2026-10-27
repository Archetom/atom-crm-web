/**
 * Product availability is a small server-defined code set. Keep the UI labels
 * closed so unknown server values are never sent back from a form.
 */
export const productAvailabilityOptions = [
  { label: "上架", value: "AVAILABLE" },
  { label: "下架", value: "UNAVAILABLE" },
] as const;

export type ProductAvailability = (typeof productAvailabilityOptions)[number]["value"];

export function isProductAvailability(value: unknown): value is ProductAvailability {
  return value === "AVAILABLE" || value === "UNAVAILABLE";
}

export function productAvailabilityLabel(value: ProductAvailability): string {
  return value === "AVAILABLE" ? "上架" : "下架";
}
