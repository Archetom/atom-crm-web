import { describe, expect, it } from "vitest";

import {
  leadListDuplicateCheckSchema,
  toLeadListDuplicateCheckRequest,
} from "./lead-list-duplicate-check";

describe("lead list duplicate check", () => {
  it("requires a name or phone number and emits only the permitted input fields", () => {
    expect(leadListDuplicateCheckSchema.safeParse({ name: "", phoneNumber: "" }).success).toBe(
      false,
    );

    expect(
      toLeadListDuplicateCheckRequest(
        leadListDuplicateCheckSchema.parse({ name: "  线索 A  ", phoneNumber: "" }),
      ),
    ).toEqual({ name: "线索 A", phoneNumber: undefined });
  });

  it("rejects an invalid phone number and preserves E.164 input", () => {
    expect(
      leadListDuplicateCheckSchema.safeParse({ name: "", phoneNumber: "13812345678" }).success,
    ).toBe(false);

    expect(
      leadListDuplicateCheckSchema.parse({ name: "", phoneNumber: " +8613812345678 " }),
    ).toEqual({ name: "", phoneNumber: "+8613812345678" });
  });
});
