import type { components } from "~/api/generated/schema";

type ConnectorQuery = components["schemas"]["ConnectorQueryRequest"];

export const connectorKeys = {
  all: ["connectors"] as const,
  detail: (identityKey: string, connectorId: number) =>
    [...connectorKeys.all, "detail", identityKey, connectorId] as const,
  list: (identityKey: string, query: ConnectorQuery) =>
    [...connectorKeys.all, "list", identityKey, query] as const,
};
