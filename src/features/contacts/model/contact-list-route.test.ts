import { describe, expect, it } from "vitest";

import { selectedContactIdFromSearch } from "./contact-list-route";

describe("contact list detail selection", () => {
  it("restores only a positive safe contact ID from the list URL", () => {
    expect(selectedContactIdFromSearch("keyword=foo&contactId=42")).toBe(42);
    expect(selectedContactIdFromSearch("contactId=0")).toBeNull();
    expect(selectedContactIdFromSearch("contactId=-42")).toBeNull();
    expect(selectedContactIdFromSearch("contactId=42.5")).toBeNull();
    expect(selectedContactIdFromSearch("contactId=9007199254740992")).toBeNull();
  });
});
