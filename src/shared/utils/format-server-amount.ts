/** Formats a server-provided amount without performing browser-side arithmetic. */
export function formatServerAmount(amount: number | string | null): string {
  if (amount === null) return "—";
  if (typeof amount === "string") return amount;

  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}
