import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFavourites } from "@/context/FavouritesContext";
import { useBills } from "@/hooks/useBills";
import { useBillTypes } from "@/hooks/useBillTypes";
import type { Bill } from "@/types";
import { BillsTable } from "./BillsTable";

vi.mock("@/hooks/useBills");
vi.mock("@/hooks/useBillTypes");
vi.mock("@/context/FavouritesContext");

const mockUseBills = vi.mocked(useBills);
const mockUseBillTypes = vi.mocked(useBillTypes);
const mockUseFavourites = vi.mocked(useFavourites);

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: "bill-1",
    billNo: "1",
    billYear: "2026",
    billNoDisplay: "1/2026",
    billType: "Public",
    status: "First Stage",
    shortTitleEn: "",
    shortTitleGa: "",
    longTitleEn: "",
    longTitleGa: "",
    sponsor: "Jane Doe",
    originHouse: "Dáil",
    uri: "bill-1",
    ...overrides,
  };
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

/**
 * Re-queries the combobox fresh rather than reusing an element reference
 * captured before a tab switch / rerender. MUI's Select can recreate its
 * underlying DOM node on certain state transitions, so holding onto a
 * stale reference across an `await user.click(tab)` is a common source of
 * "Unable to find role" failures that look like the combobox vanished.
 */
function getBillTypeSelect() {
  return screen.getByRole("combobox", { name: /bill type/i });
}

describe("BillsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBillTypes.mockReturnValue({ types: ["Public", "Private"], isLoading: false });

    mockUseFavourites.mockReturnValue({
      isFavourite: vi.fn().mockReturnValue(false),
      toggle: vi.fn(),
      favourites: [],
      favouriteIds: [],
    } as unknown as ReturnType<typeof useFavourites>);

    mockUseBills.mockReturnValue({
      data: { bills: [makeBill({ id: "1", billNoDisplay: "1/2026" })], total: 1 },
      isLoading: false,
      error: null,
    });
  });

  describe("rendering basics", () => {
    it("renders bills returned by useBills", () => {
      renderWithProviders(<BillsTable />);

      expect(screen.getByText("1/2026")).toBeInTheDocument();
    });

    it("shows a loading skeleton and no real rows while isLoading", () => {
      mockUseBills.mockReturnValue({ data: undefined, isLoading: true, error: null });

      renderWithProviders(<BillsTable />);

      expect(screen.queryByText("1/2026")).not.toBeInTheDocument();
    });

    it("shows an error message with the underlying error text", () => {
      mockUseBills.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Network failure"),
      });

      renderWithProviders(<BillsTable />);

      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      expect(screen.getByText(/network failure/i)).toBeInTheDocument();
    });

    it("shows an empty-state message when there are no bills", () => {
      mockUseBills.mockReturnValue({
        data: { bills: [], total: 0 },
        isLoading: false,
        error: null,
      });

      renderWithProviders(<BillsTable />);

      expect(screen.getByText(/no bills match the current filter/i)).toBeInTheDocument();
    });
  });

  describe("shouldLoadAllBills wiring", () => {
    it("calls useBillTypes and useBills with filterTouched=false before the dropdown is opened", () => {
      renderWithProviders(<BillsTable />);

      expect(mockUseBillTypes).toHaveBeenCalledWith(false);
      expect(mockUseBills).toHaveBeenCalledWith(expect.objectContaining({ filterTouched: false }));
    });

    it("flips shouldLoadAllBills to true for both hooks once the dropdown is opened", async () => {
      const user = userEvent.setup();
      renderWithProviders(<BillsTable />);

      await user.click(getBillTypeSelect());

      expect(mockUseBillTypes).toHaveBeenLastCalledWith(true);
      expect(mockUseBills).toHaveBeenLastCalledWith(
        expect.objectContaining({ filterTouched: true }),
      );
    });
  });

  describe("type filter dropdown", () => {
    it("shows 'Loading types…' while isBillTypesLoading is true and the dropdown has been opened", async () => {
      mockUseBillTypes.mockReturnValue({ types: [], isLoading: true });

      const user = userEvent.setup();
      renderWithProviders(<BillsTable />);

      await user.click(getBillTypeSelect());

      expect(await screen.findByText(/loading types/i)).toBeInTheDocument();
    });

    it("passes the selected type filter through to useBills", async () => {
      const user = userEvent.setup();
      renderWithProviders(<BillsTable />);

      await user.click(getBillTypeSelect());
      const listbox = await screen.findByRole("listbox");
      await user.click(within(listbox).getByRole("option", { name: "Public" }));

      expect(mockUseBills).toHaveBeenLastCalledWith(
        expect.objectContaining({ typeFilter: "Public" }),
      );
    });

    it("resets the filter and displays 'All types' when that option is selected", async () => {
      const user = userEvent.setup();
      renderWithProviders(<BillsTable />);

      await user.click(getBillTypeSelect());
      let listbox = await screen.findByRole("listbox");
      await user.click(within(listbox).getByRole("option", { name: "Public" }));

      // re-query the select fresh rather than reusing the pre-selection reference
      await user.click(getBillTypeSelect());
      listbox = await screen.findByRole("listbox");
      await user.click(within(listbox).getByRole("option", { name: "All types" }));

      expect(mockUseBills).toHaveBeenLastCalledWith(expect.objectContaining({ typeFilter: "" }));
      expect(getBillTypeSelect()).toHaveTextContent("All types");
    });
  });

  describe("tabs and favourites", () => {
    it("filters favourites client-side by the selected type", async () => {
      mockUseFavourites.mockReturnValue({
        isFavourite: vi.fn().mockReturnValue(true),
        toggle: vi.fn(),
        favourites: [
          makeBill({ id: "f1", billNoDisplay: "10/2026", billType: "Public" }),
          makeBill({ id: "f2", billNoDisplay: "11/2026", billType: "Private" }),
        ],
        favouriteIds: ["f1", "f2"],
      } as unknown as ReturnType<typeof useFavourites>);

      const user = userEvent.setup();
      renderWithProviders(<BillsTable />);

      const favouritesTab = screen.getByRole("tab", { name: /favourites/i });
      await user.click(favouritesTab);

      // wait for the tab switch to settle before any further queries
      expect(await screen.findByText("10/2026")).toBeInTheDocument();
      expect(screen.getByText("11/2026")).toBeInTheDocument();

      // re-query the combobox fresh, after the tab switch has fully
      // committed, rather than reusing a reference captured pre-switch
      const select = getBillTypeSelect();
      await user.click(select);

      const listbox = await screen.findByRole("listbox");
      await user.click(within(listbox).getByRole("option", { name: "Public" }));

      expect(await screen.findByText("10/2026")).toBeInTheDocument();
      expect(screen.queryByText("11/2026")).not.toBeInTheDocument();
    });

    it("shows the favourites count badge in the tab label", () => {
      mockUseFavourites.mockReturnValue({
        isFavourite: vi.fn().mockReturnValue(true),
        toggle: vi.fn(),
        favourites: [makeBill({ id: "f1" }), makeBill({ id: "f2" })],
        favouriteIds: ["f1", "f2"],
      } as unknown as ReturnType<typeof useFavourites>);

      renderWithProviders(<BillsTable />);

      expect(screen.getByRole("tab", { name: /favourites \(2\)/i })).toBeInTheDocument();
    });

    it("shows the favourites empty-state message when there are none", async () => {
      const user = userEvent.setup();
      renderWithProviders(<BillsTable />);

      await user.click(screen.getByRole("tab", { name: /favourites/i }));

      expect(await screen.findByText(/no favourited bills yet/i)).toBeInTheDocument();
    });
  });

  describe("pagination controls", () => {
    it("exposes accessible names for all four pagination buttons", () => {
      renderWithProviders(<BillsTable />);

      expect(screen.getByRole("button", { name: "First page" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Previous page" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Last page" })).toBeInTheDocument();
    });

    it("disables First/Previous on the first page and Next/Last when there's only one page", () => {
      renderWithProviders(<BillsTable />);

      expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Last page" })).toBeDisabled();
    });

    it("keeps independent pagination state per tab", async () => {
      mockUseFavourites.mockReturnValue({
        isFavourite: vi.fn().mockReturnValue(true),
        toggle: vi.fn(),
        favourites: Array.from({ length: 25 }, (_, i) =>
          makeBill({ id: `f${i}`, billNoDisplay: `${i}/2026` }),
        ),
        favouriteIds: Array.from({ length: 25 }, (_, i) => `f${i}`),
      } as unknown as ReturnType<typeof useFavourites>);

      const user = userEvent.setup();
      renderWithProviders(<BillsTable />);

      await user.click(screen.getByRole("tab", { name: /favourites/i }));
      expect(await screen.findByText(/1–20 of 25/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Next page" }));
      expect(await screen.findByText(/21–25 of 25/)).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: /all bills/i }));
      await user.click(screen.getByRole("tab", { name: /favourites/i }));

      expect(await screen.findByText(/21–25 of 25/)).toBeInTheDocument();
    });
  });

  describe("row interaction", () => {
    it("clicking a row does not throw and the row remains rendered", async () => {
      const user = userEvent.setup();
      renderWithProviders(<BillsTable />);

      const row = screen.getByText("1/2026").closest("tr");
      expect(row).not.toBeNull();

      await user.click(row as HTMLElement);

      expect(screen.getByText("1/2026")).toBeInTheDocument();
    });

    it("activating a row via keyboard (Enter) does not throw", async () => {
      const user = userEvent.setup();
      renderWithProviders(<BillsTable />);

      const row = screen.getByText("1/2026").closest("tr") as HTMLElement;
      row.focus();
      await user.keyboard("{Enter}");

      expect(screen.getByText("1/2026")).toBeInTheDocument();
    });
  });
});
