import { Button } from "antd";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataWorkspace } from "./data-workspace";
import { DetailWorkspace } from "./detail-workspace";
import { FilterBar } from "./filter-bar";
import { FormWorkspace } from "./form-workspace";
import { PageHeader } from "./page-header";

afterEach(cleanup);

describe("page workspace components", () => {
  it("keeps the page title and actions in one header", () => {
    const onCreate = vi.fn();
    const onNearby = vi.fn();

    render(
      <PageHeader
        description="客户数据由服务端决定。"
        moreLabel="更多客户操作"
        primaryAction={{ key: "create", label: "新建客户", onClick: onCreate }}
        secondaryActions={[{ key: "nearby", label: "附近客户", onClick: onNearby }]}
        title="客户"
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "客户" })).toBeInTheDocument();
    expect(screen.getByText("客户数据由服务端决定。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更多客户操作" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "附近客户" }));
    fireEvent.click(screen.getByRole("button", { name: "新建客户" }));

    expect(onNearby).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("submits searches and exposes active-filter clearing", () => {
    const onSearch = vi.fn();
    const onClear = vi.fn();
    const onClearAll = vi.fn();

    render(
      <FilterBar
        activeFilters={[{ key: "keyword", label: "关键词：原始值", onClear }]}
        search={{
          label: "搜索客户",
          placeholder: "搜索客户名称",
          value: "原始值",
          onSearch,
        }}
        onClearAll={onClearAll}
      >
        <Button>保存视图</Button>
      </FilterBar>,
    );

    const search = screen.getByRole("searchbox", { name: "搜索客户" });
    fireEvent.change(search, { target: { value: "Atom" } });
    fireEvent.keyDown(search, { key: "Enter", code: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "清除全部条件" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onSearch.mock.calls[0]?.[0]).toBe("Atom");
    expect(onClearAll).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("keeps loading and error placement inside the data workspace", () => {
    render(
      <DataWorkspace errorMessage="客户列表暂时无法加载" label="客户数据工作区">
        <div>列表内容</div>
      </DataWorkspace>,
    );

    expect(screen.getByRole("region", { name: "客户数据工作区" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("客户列表暂时无法加载");
    expect(screen.getByText("列表内容")).toBeInTheDocument();
  });

  it("keeps form actions in the labeled sticky workspace", () => {
    render(
      <FormWorkspace footer={<Button type="primary">保存客户</Button>} label="客户基础信息表单">
        <label htmlFor="customer-name">客户名称</label>
        <input id="customer-name" />
      </FormWorkspace>,
    );

    expect(screen.getByRole("region", { name: "客户基础信息表单" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存客户" })).toBeInTheDocument();
  });

  it("keeps an optional summary separate from detail content", () => {
    render(
      <DetailWorkspace header={<h1>客户详情</h1>} summary={<div>业务概览</div>}>
        <div>基础信息</div>
      </DetailWorkspace>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "客户详情" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "业务摘要" })).toHaveTextContent("业务概览");
    expect(screen.getByText("基础信息")).toBeInTheDocument();
  });
});
