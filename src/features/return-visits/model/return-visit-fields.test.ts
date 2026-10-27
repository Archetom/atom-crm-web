import { describe, expect, it } from "vitest";

import {
  returnVisitFormLabel,
  returnVisitSatisfactionLabel,
  toReturnVisitForm,
  toReturnVisitSatisfaction,
} from "./return-visit-fields";

describe("return visit field values", () => {
  it("uses only the server contract's closed return-visit forms", () => {
    expect(toReturnVisitForm("WECHAT")).toBe("WECHAT");
    expect(toReturnVisitForm("VIDEO")).toBeNull();
    expect(returnVisitFormLabel("IN_PERSON")).toBe("见面拜访");
  });

  it("uses only the server contract's closed satisfaction values", () => {
    expect(toReturnVisitSatisfaction("VERY_DISSATISFIED")).toBe("VERY_DISSATISFIED");
    expect(toReturnVisitSatisfaction("EXCELLENT")).toBeNull();
    expect(returnVisitSatisfactionLabel("VERY_SATISFIED")).toBe("很满意");
  });
});
