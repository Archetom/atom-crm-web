import { describe, expect, it } from "vitest";

import { crmContextForPath, isCrmContextRoute } from "./crm-context-navigation";

describe("CRM context navigation", () => {
  it("keeps contacts and contact pools in the same local navigation context", () => {
    expect(crmContextForPath("/crm/contacts")?.title).toBe("联系人管理");
    expect(crmContextForPath("/crm/contact-pools/8")?.title).toBe("联系人管理");
    expect(isCrmContextRoute("/crm/contact-pools")).toBe(true);
    expect(isCrmContextRoute("/crm/contacts")).toBe(false);
  });

  it("keeps the customer context separate and does not capture unrelated CRM routes", () => {
    expect(crmContextForPath("/crm/customers/8")?.title).toBe("客户管理");
    expect(isCrmContextRoute("/crm/customers")).toBe(false);
    expect(crmContextForPath("/crm/opportunities")).toBeNull();
    expect(isCrmContextRoute("/crm/opportunities")).toBe(false);
  });
});
