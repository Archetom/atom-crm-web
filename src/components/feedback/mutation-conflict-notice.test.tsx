import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "~/api/errors/api-error";

import { MutationConflictNotice } from "./mutation-conflict-notice";

afterEach(cleanup);

describe("MutationConflictNotice", () => {
  it("waits for an explicit draft-preserving decision before a refresh", () => {
    const onResolve = vi.fn();
    render(
      <MutationConflictNotice
        error={new ApiError(409, "VERSION_CONFLICT")}
        onResolve={onResolve}
      />,
    );

    expect(onResolve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "保留当前输入并刷新" }));
    expect(onResolve).toHaveBeenCalledWith("keep-draft-and-reload", "version-conflict");

    fireEvent.click(screen.getByRole("button", { name: "放弃输入并刷新" }));
    expect(onResolve).toHaveBeenCalledWith("discard-draft-and-reload", "version-conflict");
  });

  it("treats duplicate resources as a separate acknowledgement", () => {
    const onResolve = vi.fn();
    render(
      <MutationConflictNotice
        error={new ApiError(409, "RESOURCE_ALREADY_EXISTS")}
        onResolve={onResolve}
      />,
    );

    expect(screen.queryByRole("button", { name: "保留当前输入并刷新" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(onResolve).toHaveBeenCalledWith("dismiss", "resource-already-exists");
  });

  it("does not render a generic notice for unrecognized failures", () => {
    const { container } = render(
      <MutationConflictNotice
        error={new ApiError(409, "UNREVIEWED_CONFLICT")}
        onResolve={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
