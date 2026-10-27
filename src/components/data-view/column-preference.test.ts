import { describe, expect, it } from "vitest";

import {
  fieldLayoutUpdateForColumns,
  visibleColumnCodes,
  type ColumnPreferenceOption,
} from "./column-preference";

const options: ColumnPreferenceOption[] = [
  { code: "name", label: "名称" },
  { code: "owner", label: "负责人" },
  { code: "status", label: "状态" },
];

describe("column preference", () => {
  it("honors the server's hidden fields and ordering", () => {
    expect(
      visibleColumnCodes(options, {
        columnWidths: {},
        hiddenCodes: ["owner"],
        objectType: "CUSTOMER",
        orderedCodes: ["status", "owner", "name"],
        pinnedCodes: [],
        version: 3,
      }),
    ).toEqual(["status", "name"]);
  });

  it("updates only the managed list fields while preserving the remaining layout", () => {
    expect(
      fieldLayoutUpdateForColumns(
        {
          columnWidths: { custom: 260 },
          hiddenCodes: ["custom", "owner"],
          objectType: "CUSTOMER",
          orderedCodes: ["custom", "name", "owner", "status"],
          pinnedCodes: ["custom"],
          version: 4,
        },
        options,
        ["name", "status"],
      ),
    ).toEqual({
      columnWidths: { custom: 260 },
      hiddenCodes: ["custom", "owner"],
      orderedCodes: ["custom", "name", "owner", "status"],
      pinnedCodes: ["custom"],
      version: 4,
    });
  });
});
