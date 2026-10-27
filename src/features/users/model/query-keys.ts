import type { components } from "~/api/generated/schema";

type UserQuery = components["schemas"]["UserQueryRequest"];

export const userKeys = {
  all: ["users"] as const,
  list: (identityKey: string, request: UserQuery) =>
    ["users", "list", identityKey, request] as const,
};
