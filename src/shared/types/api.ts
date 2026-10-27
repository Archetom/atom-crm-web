import type { components } from "~/api/generated/schema";

/**
 * The committed OpenAPI snapshot is the only source of API types. These aliases exist
 * so bootstrap consumers can name the two payloads they depend on without importing
 * the generated module directly; they must never diverge from the snapshot.
 *
 * Note that every `MemberAuthorizationResponse` field is optional in the contract.
 * Consumers must fail closed on a missing field rather than assume it is present.
 */
export type MemberAuthorization = components["schemas"]["MemberAuthorizationResponse"];

export type NavigationItem = components["schemas"]["NavigationItemResponse"];
