import { Button } from "antd";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PageResult } from "./pagination";
import { ResponsiveDataList } from "./responsive-data-list";

interface Row {
  id: number;
  name: string;
}

const page: PageResult<Row> = {
  items: [{ id: 7, name: "Atom 客户" }],
  meta: {},
  page: 1,
  size: 1,
  total: null,
};

beforeEach(() => {
  const nativeGetComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    nativeGetComputedStyle(element),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ResponsiveDataList", () => {
  it("provides the shared desktop workspace, batch slot, and unknown-total pager", () => {
    const onPageChange = vi.fn();

    render(
      <ResponsiveDataList<Row>
        bulkActions={<Button>批量归档</Button>}
        columns={[{ dataIndex: "name", fixed: "left", key: "name", title: "名称", width: 240 }]}
        page={page}
        renderMobileItem={(item) => item.name}
        rowKey={(item) => item.id}
        selectedRowCount={1}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByLabelText("桌面列表")).toBeInTheDocument();
    expect(screen.getAllByText("Atom 客户")).toHaveLength(2);
    expect(screen.getByLabelText("已选择的列表项操作")).toHaveTextContent("已选择 1 项");
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));

    expect(onPageChange).toHaveBeenCalledWith(2, 1);
  });
});
