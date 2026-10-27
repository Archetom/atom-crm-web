import { describe, expect, it } from "vitest";

import { decodeDepartmentOptions } from "./department-option";

describe("decodeDepartmentOptions", () => {
  it("keeps active server-visible departments only", () => {
    expect(
      decodeDepartmentOptions([
        { id: 7, name: "华东销售", active: true },
        { id: 8, name: "停用部门", active: false },
        { id: 7, name: "重复", active: true },
      ]),
    ).toEqual([{ departmentId: 7, name: "华东销售" }]);
  });

  it("rejects a response that is not a server department collection", () => {
    expect(() => decodeDepartmentOptions({})).toThrow("部门选择数据暂时不可用");
  });
});
