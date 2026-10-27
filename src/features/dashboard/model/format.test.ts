import { describe, expect, it } from "vitest";

import { formatServerAmount } from "./format";

describe("formatServerAmount", () => {
  it("does not perform arithmetic on a string amount", () => {
    expect(formatServerAmount("123.4500")).toBe("123.4500");
  });

  it("renders null as unavailable", () => {
    expect(formatServerAmount(null)).toBe("—");
  });
});
