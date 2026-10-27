import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListStarToggle } from "./list-star-toggle";

describe("ListStarToggle", () => {
  it("announces the next personal follow action and sends its next value", () => {
    const onToggle = vi.fn();

    render(<ListStarToggle loading={false} starred={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: "关注" }));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("allows a followed record to be unfollowed", () => {
    const onToggle = vi.fn();

    render(<ListStarToggle loading={false} starred onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: "取消关注" }));

    expect(onToggle).toHaveBeenCalledWith(false);
  });
});
