import { describe, expect, it } from "vitest";

import { decodeActivityMethodOptions } from "./activity-option";

describe("decodeActivityMethodOptions", () => {
  it("keeps ordered server-governed methods and ignores templates", () => {
    expect(
      decodeActivityMethodOptions([
        { displayOrder: 20, label: "会议", type: "METHOD", value: "MEETING" },
        { displayOrder: 10, label: "通用模板", type: "TEMPLATE", value: "GENERAL" },
        { displayOrder: 10, label: "电话", type: "METHOD", value: "CALL" },
      ]),
    ).toEqual([
      { label: "电话", value: "CALL" },
      { label: "会议", value: "MEETING" },
    ]);
  });

  it("fails closed for an unusable method catalog", () => {
    expect(() => decodeActivityMethodOptions([])).toThrow("跟进方式数据暂时不可用");
    expect(() =>
      decodeActivityMethodOptions([
        { displayOrder: 10, label: "电话", type: "METHOD", value: "CALL" },
        { displayOrder: 20, label: "重复", type: "METHOD", value: "CALL" },
      ]),
    ).toThrow("跟进方式数据暂时不可用");
  });
});
