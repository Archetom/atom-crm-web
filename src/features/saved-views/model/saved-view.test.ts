import { describe, expect, it } from "vitest";

import { resolveSavedView, savedViewSelectionFromSearch, type SavedView } from "./saved-view";

const views: SavedView[] = [
  {
    conditions: [],
    createdTime: "2026-07-30T12:00:00Z",
    defaultView: true,
    hidden: false,
    id: 4,
    name: "我的默认视图",
    objectType: "CUSTOMER",
    sortOrder: 0,
    updatedTime: "2026-07-30T12:00:00Z",
    version: 1,
  },
  {
    conditions: [],
    createdTime: "2026-07-30T12:00:00Z",
    defaultView: false,
    hidden: false,
    id: 7,
    name: "重点客户",
    objectType: "CUSTOMER",
    sortOrder: 1,
    updatedTime: "2026-07-30T12:00:00Z",
    version: 2,
  },
];

describe("resolveSavedView", () => {
  it("uses the server default only when the URL has no explicit selection", () => {
    expect(resolveSavedView(views, undefined)?.id).toBe(4);
    expect(resolveSavedView(views, 7)?.id).toBe(7);
  });

  it("allows an explicit all-records choice and ignores a stale id", () => {
    expect(resolveSavedView(views, null)).toBeUndefined();
    expect(resolveSavedView(views, 99)).toBeUndefined();
  });

  it("restores only a positive saved-view identifier from the URL", () => {
    expect(savedViewSelectionFromSearch("")).toBeUndefined();
    expect(savedViewSelectionFromSearch("savedView=all")).toBeNull();
    expect(savedViewSelectionFromSearch("savedView=7")).toBe(7);
    expect(savedViewSelectionFromSearch("savedView=invalid")).toBeUndefined();
  });
});
