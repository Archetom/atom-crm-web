import { describe, expect, it } from "vitest";

import { toLeadConversion } from "./lead-conversion";

describe("toLeadConversion", () => {
  it("keeps only the server-returned conversion identifiers for the requested lead", () => {
    expect(
      toLeadConversion({ leadId: 8, customerId: 9, contactId: 10, leadVersion: 4 }, 8),
    ).toEqual({ leadId: 8, customerId: 9, contactId: 10, leadVersion: 4 });
  });

  it("fails closed when the response is malformed or names another lead", () => {
    expect(toLeadConversion({ leadId: 7, customerId: 9, contactId: 10, leadVersion: 4 }, 8)).toBe(
      null,
    );
    expect(toLeadConversion({ leadId: 8, customerId: 9, contactId: 10, leadVersion: -1 }, 8)).toBe(
      null,
    );
  });
});
