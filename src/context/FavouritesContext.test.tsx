/**
 * Unit + integration tests for FavouritesContext.
 *
 * Covers:
 *  - Initial state
 *  - Optimistic toggle
 *  - Server confirmation → success state
 *  - Server failure → revert to previous state
 *  - localStorage: persists on favourite
 *  - localStorage: persists removal (unfavourite)
 *  - localStorage: hydrates on mount
 *  - Unfavourite flow (toggle from true → false)
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as billsApi from "@/api/bills";
import { STORAGE_KEY, useFavourites } from "@/context/FavouritesContext";
import { renderWithProviders } from "@/test/utils";

// ─── Test consumer component ───────────────────────────────────────────────

function TestConsumer({ billId }: { billId: string }) {
  const { isFavourite, getStatus, toggle, favouriteIds } = useFavourites();
  return (
    <div>
      <span data-testid="is-fav">{String(isFavourite(billId))}</span>
      <span data-testid="status">{getStatus(billId)}</span>
      <span data-testid="fav-count">{favouriteIds.length}</span>
      <button type="button" onClick={() => void toggle(billId)}>
        Toggle
      </button>
    </div>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("FavouritesContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts with no favourites", () => {
    renderWithProviders(<TestConsumer billId="bill-1" />);
    expect(screen.getByTestId("is-fav")).toHaveTextContent("false");
    expect(screen.getByTestId("fav-count")).toHaveTextContent("0");
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
  });

  it("optimistically marks as favourite immediately on toggle", async () => {
    // Use a promise we control so we can check the optimistic state
    let resolveApi!: (v: { success: boolean }) => void;
    vi.spyOn(billsApi, "toggleFavouriteBillApi").mockReturnValue(
      new Promise((res) => {
        resolveApi = res;
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<TestConsumer billId="bill-1" />);

    await user.click(screen.getByRole("button", { name: "Toggle" }));

    // Optimistic update should be instant — before server responds
    expect(screen.getByTestId("is-fav")).toHaveTextContent("true");
    expect(screen.getByTestId("status")).toHaveTextContent("loading");

    // Resolve the server call
    resolveApi({ success: true });
  });

  it("confirms favourite after server success", async () => {
    vi.spyOn(billsApi, "toggleFavouriteBillApi").mockResolvedValue({
      success: true,
    });
    const user = userEvent.setup();
    renderWithProviders(<TestConsumer billId="bill-1" />);

    await user.click(screen.getByRole("button", { name: "Toggle" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("success"));
    expect(screen.getByTestId("is-fav")).toHaveTextContent("true");
  });

  it("reverts optimistic update on server error", async () => {
    vi.spyOn(billsApi, "toggleFavouriteBillApi").mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderWithProviders(<TestConsumer billId="bill-1" />);

    await user.click(screen.getByRole("button", { name: "Toggle" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    // Should have reverted back to false
    expect(screen.getByTestId("is-fav")).toHaveTextContent("false");
  });

  it("persists favourites to localStorage after server confirms", async () => {
    vi.spyOn(billsApi, "toggleFavouriteBillApi").mockResolvedValue({
      success: true,
    });
    const user = userEvent.setup();
    renderWithProviders(<TestConsumer billId="bill-1" />);

    await user.click(screen.getByRole("button", { name: "Toggle" }));

    // Wait for the UI to reflect success
    await waitFor(() => expect(screen.getByTestId("is-fav")).toHaveTextContent("true"));

    // localStorage should now contain the bill ID
    await waitFor(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const ids: string[] = JSON.parse("stored!");
      expect(ids).toContain("bill-1");
    });
  });

  it("can unfavourite a bill and removes it from localStorage", async () => {
    vi.spyOn(billsApi, "toggleFavouriteBillApi").mockResolvedValue({
      success: true,
    });
    // Pre-seed localStorage so the bill starts as favourite
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["bill-1"]));
    const user = userEvent.setup();

    renderWithProviders(<TestConsumer billId="bill-1" />);

    // Wait for hydration
    await waitFor(() => expect(screen.getByTestId("is-fav")).toHaveTextContent("true"));

    // Toggle OFF
    await user.click(screen.getByRole("button", { name: "Toggle" }));

    // Should now be false
    await waitFor(() => expect(screen.getByTestId("is-fav")).toHaveTextContent("false"));

    // localStorage should no longer contain the bill
    await waitFor(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      const ids: string[] = stored ? JSON.parse(stored) : [];
      expect(ids).not.toContain("bill-1");
    });
  });

  it("hydrates from localStorage on mount", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["bill-42", "bill-7"]));

    renderWithProviders(<TestConsumer billId="bill-42" />);

    // Wait for useEffect hydration to dispatch
    await waitFor(() => expect(screen.getByTestId("is-fav")).toHaveTextContent("true"));
    expect(screen.getByTestId("fav-count")).toHaveTextContent("2");
  });

  it("handles corrupt localStorage gracefully", async () => {
    localStorage.setItem(STORAGE_KEY, "not-valid-json{{{");

    // Should not throw; should start with empty state
    renderWithProviders(<TestConsumer billId="bill-1" />);

    expect(screen.getByTestId("is-fav")).toHaveTextContent("false");
    expect(screen.getByTestId("fav-count")).toHaveTextContent("0");
  });

  it("does not write to localStorage if server errors (reverted)", async () => {
    vi.spyOn(billsApi, "toggleFavouriteBillApi").mockRejectedValue(new Error("Server error"));
    const user = userEvent.setup();
    renderWithProviders(<TestConsumer billId="bill-1" />);

    await user.click(screen.getByRole("button", { name: "Toggle" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));

    // After revert, storage should be empty
    const stored = localStorage.getItem(STORAGE_KEY);
    const ids: string[] = stored ? JSON.parse(stored) : [];
    expect(ids).not.toContain("bill-1");
  });
});
