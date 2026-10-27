import { recordOf } from "~/shared/utils/decode";

export const customerBusinessOverviewSources = [
  "CONTACT",
  "OPEN_OPPORTUNITY",
  "ACTIVE_CONTRACT",
  "PENDING_INVOICE",
  "ACTIVE_RECEIVABLE",
  "ACTIVE_RECEIVABLE_PLAN",
  "RETURN_VISIT",
] as const;

export type CustomerBusinessOverviewSource = (typeof customerBusinessOverviewSources)[number];

export interface CustomerBusinessOverviewCard {
  source: CustomerBusinessOverviewSource;
  status: "AVAILABLE" | "UNAVAILABLE";
  count: number | null;
  amount: number | string | null;
}

export interface CustomerBusinessOverview {
  customerId: number;
  cards: readonly CustomerBusinessOverviewCard[];
}

function isSource(value: unknown): value is CustomerBusinessOverviewSource {
  return (
    typeof value === "string" &&
    customerBusinessOverviewSources.includes(value as CustomerBusinessOverviewSource)
  );
}

function toAmount(value: unknown): number | string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toCard(value: unknown): CustomerBusinessOverviewCard | null {
  const source = recordOf(value);
  if (!source || !isSource(source.source)) return null;

  if (source.status === "UNAVAILABLE") {
    return { source: source.source, status: source.status, count: null, amount: null };
  }

  if (
    source.status !== "AVAILABLE" ||
    typeof source.count !== "number" ||
    !Number.isSafeInteger(source.count) ||
    source.count < 0
  ) {
    return null;
  }

  const amount = toAmount(source.amount);
  if (source.amount !== null && source.amount !== undefined && amount === null) return null;

  return { source: source.source, status: source.status, count: source.count, amount };
}

/**
 * Decodes the fixed, server-authorized overview response. Unknown or malformed
 * cards are rejected so the UI never treats a partial contract as permission data.
 */
export function toCustomerBusinessOverview(
  value: unknown,
  expectedCustomerId: number,
): CustomerBusinessOverview | null {
  const source = recordOf(value);
  if (
    !source ||
    source.customerId !== expectedCustomerId ||
    !Number.isSafeInteger(expectedCustomerId) ||
    expectedCustomerId <= 0 ||
    !Array.isArray(source.cards)
  ) {
    return null;
  }

  const cards = source.cards.map(toCard);
  if (cards.some((card) => card === null)) return null;

  const knownCards = cards.filter((card): card is CustomerBusinessOverviewCard => card !== null);
  if (
    knownCards.length !== customerBusinessOverviewSources.length ||
    new Set(knownCards.map((card) => card.source)).size !== customerBusinessOverviewSources.length
  ) {
    return null;
  }

  return {
    customerId: expectedCustomerId,
    cards: customerBusinessOverviewSources.map((sourceCode) =>
      knownCards.find((card) => card.source === sourceCode)!,
    ),
  };
}
