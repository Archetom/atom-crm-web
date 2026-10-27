import { describe, expect, it } from "vitest";

import {
  toPersonalInvoiceProfileCreateRequest,
  toPersonalInvoiceProfileTitleUpdateRequest,
} from "./invoice-profile-form";

describe("toPersonalInvoiceProfileCreateRequest", () => {
  it("sends only the customer, explicit title, and individual title type", () => {
    expect(toPersonalInvoiceProfileCreateRequest({ customerId: 6, title: "张三" })).toEqual({
      customerId: 6,
      title: "张三",
      titleType: "INDIVIDUAL",
    });
  });

  it("updates only an explicit personal title with its version", () => {
    expect(toPersonalInvoiceProfileTitleUpdateRequest({ title: "李四", version: 3 })).toEqual({
      title: "李四",
      version: 3,
    });
  });
});
