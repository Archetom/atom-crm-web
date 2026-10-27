import { describe, expect, it } from "vitest";

import { authority, hasAuthority } from "./authority";

describe("hasAuthority", () => {
  const authorization = { authorities: ["customers:read", "navigation:read"] };

  it("allows routes that have no authority requirement", () => {
    expect(hasAuthority(authorization, null)).toBe(true);
  });

  it("does not infer an ungranted authority", () => {
    expect(hasAuthority(authorization, "customers:write")).toBe(false);
  });

  it("allows an explicitly granted authority", () => {
    expect(hasAuthority(authorization, "customers:read")).toBe(true);
  });

  it("uses the backend return-visit authority codes", () => {
    expect(authority.navigationRead).toBe("navigation:read");
    expect(authority.navigationWrite).toBe("navigation:write");
    expect(authority.returnVisitsRead).toBe("return-visits:read");
    expect(authority.returnVisitsWrite).toBe("return-visits:write");
    expect(authority.returnVisitsDelete).toBe("return-visits:delete");
    expect(authority.returnVisitsAssign).toBe("return-visits:assign");
    expect(authority.worklistRead).toBe("worklist:read");
    expect(authority.contractsRead).toBe("contracts:read");
    expect(authority.contractsWrite).toBe("contracts:write");
    expect(authority.contractsDelete).toBe("contracts:delete");
    expect(authority.contractsAssign).toBe("contracts:assign");
    expect(authority.invoicesRead).toBe("invoices:read");
    expect(authority.invoicesWrite).toBe("invoices:write");
    expect(authority.invoicesDelete).toBe("invoices:delete");
    expect(authority.invoicesIssue).toBe("invoices:issue");
    expect(authority.invoicesAssign).toBe("invoices:assign");
    expect(authority.receivablesWrite).toBe("receivables:write");
    expect(authority.receivablesDelete).toBe("receivables:delete");
    expect(authority.receivablesAssign).toBe("receivables:assign");
    expect(authority.receivablePlansWrite).toBe("receivable-plans:write");
    expect(authority.receivablePlansDelete).toBe("receivable-plans:delete");
    expect(authority.workTasksRead).toBe("work-tasks:read");
    expect(authority.workTasksWrite).toBe("work-tasks:write");
    expect(authority.workTasksManage).toBe("work-tasks:manage");
    expect(authority.approvalsRead).toBe("approvals:read");
    expect(authority.approvalsSubmit).toBe("approvals:submit");
    expect(authority.approvalsReview).toBe("approvals:review");
    expect(authority.approvalsManage).toBe("approvals:manage");
    expect(authority.workflowsRead).toBe("workflows:read");
    expect(authority.workflowsManage).toBe("workflows:manage");
    expect(authority.fieldsRead).toBe("fields:read");
    expect(authority.fieldsWrite).toBe("fields:write");
    expect(authority.savedViewsRead).toBe("saved-views:read");
    expect(authority.savedViewsWrite).toBe("saved-views:write");
    expect(authority.embeddedPagesRead).toBe("embedded-pages:read");
    expect(authority.embeddedPagesWrite).toBe("embedded-pages:write");
    expect(authority.usersRead).toBe("users:read");
    expect(authority.usersWrite).toBe("users:write");
    expect(authority.usersDelete).toBe("users:delete");
    expect(authority.connectorsRead).toBe("connectors:read");
    expect(authority.connectorsManage).toBe("connectors:manage");
    expect(authority.enterpriseDataRead).toBe("enterprise-data:read");
    expect(authority.organizationRequest).toBe("organization:request");
  });
});
