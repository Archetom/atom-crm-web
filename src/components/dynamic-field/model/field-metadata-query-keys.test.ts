import { describe, expect, it } from "vitest";

import { createFieldMetadataQueryKeys } from "./field-metadata-query-keys";

describe("createFieldMetadataQueryKeys", () => {
  it("isolates definitions and member layout by identity, object and access context", () => {
    const keys = createFieldMetadataQueryKeys("tenant:1:actor:7", "CUSTOMER", "fields:read");

    expect(keys.definitions).toEqual([
      "field-metadata",
      "tenant:1:actor:7",
      "CUSTOMER",
      "fields:read",
      "definitions",
    ]);
    expect(keys.layout).toEqual([
      "field-metadata",
      "tenant:1:actor:7",
      "CUSTOMER",
      "fields:read",
      "layout",
    ]);
  });
});
