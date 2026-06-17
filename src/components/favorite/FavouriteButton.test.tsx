/**
 * Unit tests for FavouriteButton.
 *
 * Tests:
 *  - ARIA attributes in each state
 *  - Toggle fires on click
 *  - Toggle fires on keyboard Enter / Space
 *  - No toggle when loading or disabled
 *  - Error state renders correctly
 *  - Click propagation is stopped
 */

import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FavouriteButton } from "@/components/favorite/FavouriteButton";
import { renderWithProviders } from "@/test/utils";

describe("FavouriteButton", () => {
  const mockToggle = vi.fn();

  beforeEach(() => {
    mockToggle.mockClear();
  });

  it("shows 'add' state when not favourited", () => {
    renderWithProviders(
      <FavouriteButton isFavourite={false} onToggle={mockToggle} itemLabel="Bill 1" />,
    );
    const btn = screen.getByRole("button", { name: /add bill 1 to favourites/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("shows 'remove' state when favourited", () => {
    renderWithProviders(
      <FavouriteButton isFavourite={true} onToggle={mockToggle} itemLabel="Bill 1" />,
    );
    const btn = screen.getByRole("button", { name: /remove bill 1 from favourites/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onToggle when clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FavouriteButton isFavourite={false} onToggle={mockToggle} />);
    await user.click(screen.getByRole("button"));
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onToggle on Enter keydown", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FavouriteButton isFavourite={false} onToggle={mockToggle} />);
    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onToggle on Space keydown", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FavouriteButton isFavourite={false} onToggle={mockToggle} />);
    screen.getByRole("button").focus();
    await user.keyboard(" ");
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it("does not call onToggle when status is loading (button is disabled)", () => {
    renderWithProviders(
      <FavouriteButton isFavourite={false} status="loading" onToggle={mockToggle} />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    // fireEvent bypasses pointer-events:none on disabled buttons
    fireEvent.click(btn);
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it("does not call onToggle when disabled prop is true", () => {
    renderWithProviders(
      <FavouriteButton isFavourite={false} disabled={true} onToggle={mockToggle} />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it("shows error colour when status is error", () => {
    renderWithProviders(
      <FavouriteButton isFavourite={false} status="error" onToggle={mockToggle} />,
    );
    const btn = screen.getByRole("button");
    // MUI applies colorError class
    expect(btn.className).toMatch(/colorError/i);
  });

  it("stops click propagation to prevent table row activation", () => {
    const parentClick = vi.fn();
    renderWithProviders(
      // biome-ignore lint/a11y/noStaticElementInteractions: test only – verifying stopPropagation
      <div onClick={parentClick} onKeyDown={undefined}>
        <FavouriteButton isFavourite={false} onToggle={mockToggle} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(parentClick).not.toHaveBeenCalled();
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
