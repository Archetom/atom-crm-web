import { describe, expect, it } from "vitest";

import { customerRelationFilter, customerRelationOptionsQuery } from "./customer-relation-filter";

describe("customer relation filter", () => {
  it("uses a bounded server directory query instead of caller supplied relation data", () => {
    expect(customerRelationOptionsQuery("华东")).toEqual({
      keyword: "华东",
      page: 1,
      size: 50,
    });
    expect(customerRelationOptionsQuery("")).toEqual({
      keyword: undefined,
      page: 1,
      size: 50,
    });
  });

  it("keeps a stable customer-only URL parameter", () => {
    expect(customerRelationFilter).toMatchObject({
      authority: "customers:read",
      label: "客户",
      parameter: "customerId",
    });
  });
});
