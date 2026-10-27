import { describe, expect, it } from "vitest";

import { decodeMemberOptions } from "./member-option";

describe("decodeMemberOptions", () => {
  it("keeps active server-visible members only", () => {
    expect(
      decodeMemberOptions({
        objectList: [
          { actorId: 7, displayName: "张三", active: true },
          { actorId: 8, displayName: "李四", active: false },
          { actorId: 7, displayName: "重复", active: true },
        ],
      }),
    ).toEqual([{ actorId: 7, displayName: "张三" }]);
  });

  it("rejects a response without the server pager collection", () => {
    expect(() => decodeMemberOptions({})).toThrow("成员选择数据暂时不可用");
  });
});
