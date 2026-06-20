import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FavouriteButton } from "./FavouriteButton";

describe("FavouriteButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows an outlined star when not favourited", () => {
    render(<FavouriteButton isFavourite={false} onToggle={vi.fn()} />);

    expect(screen.getByTestId("StarBorderIcon")).toBeInTheDocument();
    expect(screen.queryByTestId("StarIcon")).not.toBeInTheDocument();
  });

  it("shows a filled star when favourited", () => {
    render(<FavouriteButton isFavourite={true} onToggle={vi.fn()} />);

    expect(screen.getByTestId("StarIcon")).toBeInTheDocument();
    expect(screen.queryByTestId("StarBorderIcon")).not.toBeInTheDocument();
  });

  it('uses "Add to favourites" wording and aria-pressed=false when not favourited', () => {
    render(<FavouriteButton isFavourite={false} onToggle={vi.fn()} billTitle="Bill 1/2024" />);

    const button = screen.getByRole("button", { name: "Add Bill 1/2024 to favourites" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it('uses "Remove from favourites" wording and aria-pressed=true when favourited', () => {
    render(<FavouriteButton isFavourite={true} onToggle={vi.fn()} billTitle="Bill 1/2024" />);

    const button = screen.getByRole("button", { name: "Remove Bill 1/2024 from favourites" });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it('falls back to "bill" in the aria-label when billTitle is not provided', () => {
    render(<FavouriteButton isFavourite={false} onToggle={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Add bill to favourites" })).toBeInTheDocument();
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<FavouriteButton isFavourite={false} onToggle={onToggle} />);

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("stops the click event from propagating to a parent handler", async () => {
    const onToggle = vi.fn();
    const onParentClick = vi.fn();
    const user = userEvent.setup();

    render(
      // This <div> is a minimal stand-in for "some parent element with a
      // click handler" purely to assert stopPropagation() behavior — it's
      // not meant to be a real interactive/keyboard-accessible element, so
      // a11y click/keyboard rules don't apply to this test fixture.
      // biome-ignore lint/a11y/noStaticElementInteractions: test fixture only, not a real UI element
      // biome-ignore lint/a11y/useKeyWithClickEvents: test fixture only, not a real UI element
      <div onClick={onParentClick}>
        <FavouriteButton isFavourite={false} onToggle={onToggle} />
      </div>,
    );

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
