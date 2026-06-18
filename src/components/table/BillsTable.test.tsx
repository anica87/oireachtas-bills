import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavouritesProvider } from "@/context/FavouritesContext";
import { useBills, useBillTypes } from "@/hooks/useBills";
import type { Bill } from "@/types";
import { BillsTable } from "./BillsTable";

vi.mock("@/hooks/useBills", () => ({
  useBills: vi.fn(),
  useBillTypes: vi.fn(),
}));

const mockedUseBills = vi.mocked(useBills);
const mockedUseBillTypes = vi.mocked(useBillTypes);

function buildBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: "bill-1",
    billNo: "1",
    billYear: "2024",
    billNoDisplay: "1/2024",
    billType: "Public",
    status: "First Stage",
    shortTitleEn: "Short EN",
    shortTitleGa: "Short GA",
    longTitleEn: "Long EN",
    longTitleGa: "Long GA",
    sponsor: "Micheál Martin",
    originHouse: "Dáil",
    uri: "http://data.oireachtas.ie/ie/oireachtas/bill/2024/1",
    ...overrides,
  };
}

function mockUseBillsResult(overrides: Partial<ReturnType<typeof useBills>> = {}) {
  mockedUseBills.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useBills>);
}

function renderTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <FavouritesProvider>{children}</FavouritesProvider>
      </QueryClientProvider>
    );
  }
  return render(<BillsTable />, { wrapper: Wrapper });
}

describe("BillsTable", () => {
  beforeEach(() => {
    mockedUseBillTypes.mockReturnValue(["Public", "Private"]);
    mockUseBillsResult();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows a skeleton row count matching the current page size while loading", () => {
    mockUseBillsResult({ isLoading: true });
    renderTable();

    const rows = screen.getAllByRole("row", { hidden: true }).filter((r) => r.getAttribute("aria-hidden"));
    expect(rows).toHaveLength(20);
  });

  it("shows an error message when the query fails", () => {
    mockUseBillsResult({ error: new Error("network down") });
    renderTable();

    expect(screen.getByText("Failed to load: network down")).toBeInTheDocument();
  });

  it("shows an empty state when there are no bills", () => {
    mockUseBillsResult({ data: { bills: [], total: 0 } });
    renderTable();

    expect(screen.getByText("No bills match the current filter.")).toBeInTheDocument();
  });

  it("renders a row per bill with number, type, status and sponsor", () => {
    mockUseBillsResult({
      data: { bills: [buildBill()], total: 1 },
    });
    renderTable();

    expect(screen.getByText("1/2024")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("First Stage")).toBeInTheDocument();
    expect(screen.getByText("Micheál Martin")).toBeInTheDocument();
  });

  it("shows an em dash when a bill has no sponsor", () => {
    mockUseBillsResult({
      data: { bills: [buildBill({ sponsor: "" })], total: 1 },
    });
    renderTable();

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("opens the bill modal when a row is clicked", async () => {
    const user = userEvent.setup();
    mockUseBillsResult({
      data: { bills: [buildBill({ billNoDisplay: "1/2024" })], total: 1 },
    });
    renderTable();

    await user.click(screen.getByText("1/2024"));

    expect(screen.getByRole("heading", { name: "Bill 1/2024" })).toBeInTheDocument();
  });

  it("opens the bill modal on Enter key when a row is focused", async () => {
    const user = userEvent.setup();
    mockUseBillsResult({
      data: { bills: [buildBill({ billNoDisplay: "1/2024" })], total: 1 },
    });
    renderTable();

    const row = screen.getByText("1/2024").closest("tr")!;
    row.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("heading", { name: "Bill 1/2024" })).toBeInTheDocument();
  });

  it("does not open the modal when clicking the favourite star inside a row", async () => {
    const user = userEvent.setup();
    mockUseBillsResult({
      data: { bills: [buildBill({ billNoDisplay: "1/2024" })], total: 1 },
    });
    renderTable();

    await user.click(screen.getByRole("button", { name: "Add 1/2024 to favourites" }));

    expect(screen.queryByRole("heading", { name: "Bill 1/2024" })).not.toBeInTheDocument();
  });

  it("shows a count badge on the Favourites tab once a bill is favourited", async () => {
    const user = userEvent.setup();
    mockUseBillsResult({
      data: { bills: [buildBill({ billNoDisplay: "1/2024" })], total: 1 },
    });
    renderTable();

    expect(screen.getByRole("tab", { name: "Favourites" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add 1/2024 to favourites" }));

    expect(screen.getByRole("tab", { name: "Favourites (1)" })).toBeInTheDocument();
  });

  it("shows favourited bills client-side on the Favourites tab", async () => {
    const user = userEvent.setup();
    mockUseBillsResult({
      data: { bills: [buildBill({ id: "bill-1", billNoDisplay: "1/2024" })], total: 1 },
    });
    renderTable();

    await user.click(screen.getByRole("button", { name: "Add 1/2024 to favourites" }));
    await user.click(screen.getByRole("tab", { name: "Favourites (1)" }));

    expect(screen.getByText("1/2024")).toBeInTheDocument();
  });

  it("shows the favourites empty state when no bills are favourited", async () => {
    const user = userEvent.setup();
    mockUseBillsResult({ data: { bills: [], total: 0 } });
    renderTable();

    await user.click(screen.getByRole("tab", { name: "Favourites" }));

    expect(
      screen.getByText("No favourited bills yet — click a star to save one.")
    ).toBeInTheDocument();
  });

  it("populates the bill type filter from useBillTypes", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getAllByRole("combobox")[0]);

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("All types")).toBeInTheDocument();
    expect(within(listbox).getByText("Public")).toBeInTheDocument();
    expect(within(listbox).getByText("Private")).toBeInTheDocument();
  });

  it("requests bills with the selected type filter", async () => {
    const user = userEvent.setup();
    mockUseBillsResult({ data: { bills: [], total: 0 } });
    renderTable();

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(screen.getByRole("option", { name: "Public" }));

    expect(mockedUseBills).toHaveBeenLastCalledWith(
      expect.objectContaining({ typeFilter: "Public", page: 0 })
    );
  });

  it("filters favourites client-side by the selected type", async () => {
    const user = userEvent.setup();
    mockUseBillsResult({
      data: {
        bills: [
          buildBill({ id: "bill-1", billNoDisplay: "1/2024", billType: "Public" }),
          buildBill({ id: "bill-2", billNoDisplay: "2/2024", billType: "Private" }),
        ],
        total: 2,
      },
    });
    renderTable();

    await user.click(screen.getByRole("button", { name: "Add 1/2024 to favourites" }));
    await user.click(screen.getByRole("button", { name: "Add 2/2024 to favourites" }));

    await user.click(screen.getByRole("tab", { name: "Favourites (2)" }));
    expect(screen.getByText("1/2024")).toBeInTheDocument();
    expect(screen.getByText("2/2024")).toBeInTheDocument();

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(screen.getByRole("option", { name: "Public" }));

    expect(screen.getByText("1/2024")).toBeInTheDocument();
    expect(screen.queryByText("2/2024")).not.toBeInTheDocument();
  });
});
