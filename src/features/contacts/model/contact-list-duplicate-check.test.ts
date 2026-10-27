import { describe, expect, it } from "vitest";

import {
  contactListDuplicateCheckSchema,
  toContactListDuplicateCheckRequest,
} from "./contact-list-duplicate-check";

describe("contact list duplicate check", () => {
  it("requires a name or phone number and emits only the permitted input fields", () => {
    expect(contactListDuplicateCheckSchema.safeParse({ name: "", phoneNumber: "" }).success).toBe(
      false,
    );

    expect(
      toContactListDuplicateCheckRequest(
        contactListDuplicateCheckSchema.parse({ name: "  张三  ", phoneNumber: "" }),
      ),
    ).toEqual({ name: "张三", phoneNumber: undefined });
  });

  it("rejects an invalid phone number and preserves E.164 input", () => {
    expect(
      contactListDuplicateCheckSchema.safeParse({ name: "", phoneNumber: "13812345678" }).success,
    ).toBe(false);

    expect(
      contactListDuplicateCheckSchema.parse({ name: "", phoneNumber: " +8613812345678 " }),
    ).toEqual({ name: "", phoneNumber: "+8613812345678" });
  });
});
