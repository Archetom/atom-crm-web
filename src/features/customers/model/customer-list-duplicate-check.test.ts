import { describe, expect, it } from "vitest";

import {
  customerListDuplicateCheckSchema,
  toCustomerListDuplicateCheckRequest,
} from "./customer-list-duplicate-check";

describe("customer list duplicate check", () => {
  it("requires one visible identity and serializes only the supplied generated fields", () => {
    expect(customerListDuplicateCheckSchema.safeParse({ name: "", phoneNumber: "" }).success).toBe(
      false,
    );

    const values = customerListDuplicateCheckSchema.parse({
      name: "  Acme  ",
      phoneNumber: "",
    });

    expect(toCustomerListDuplicateCheckRequest(values)).toEqual({
      name: "Acme",
      phoneNumber: undefined,
    });
  });

  it("retains the reviewed E.164 validation for a phone-only lookup", () => {
    expect(
      customerListDuplicateCheckSchema.safeParse({ name: "", phoneNumber: "13812345678" }).success,
    ).toBe(false);
    expect(
      toCustomerListDuplicateCheckRequest(
        customerListDuplicateCheckSchema.parse({ name: "", phoneNumber: " +8613812345678 " }),
      ),
    ).toEqual({ name: undefined, phoneNumber: "+8613812345678" });
  });
});
