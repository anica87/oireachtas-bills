import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FavouritesProvider } from "@/context/FavouritesContext";
import type { Bill } from "@/types";
import { BillModal } from "./BillModal";

function buildBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: "bill-1",
    billNo: "42",
    billYear: "2024",
    billNoDisplay: "42/2024",
    billType: "Public",
    status: "First Stage",
    shortTitleEn: "Short EN",
    shortTitleGa: "Short GA",
    longTitleEn: "Long English Title",
    longTitleGa: "Long Gaeilge Title",
    sponsor: "Micheál Martin",
    originHouse: "Dáil",
    uri: "http://data.oireachtas.ie/ie/oireachtas/bill/2024/42",
    ...overrides,
  };
}

function renderModal(props: Partial<React.ComponentProps<typeof BillModal>> = {}) {
  const onClose = vi.fn();
  const utils = render(
    <FavouritesProvider>
      <BillModal bill={buildBill()} open={true} onClose={onClose} {...props} />
    </FavouritesProvider>
  );
  return { ...utils, onClose };
}

describe("BillModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when bill is null", () => {
    render(
      <FavouritesProvider>
        <BillModal bill={null} open={true} onClose={vi.fn()} />
      </FavouritesProvider>
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("does not render dialog content when open is false", () => {
    render(
      <FavouritesProvider>
        <BillModal bill={buildBill()} open={false} onClose={vi.fn()} />
      </FavouritesProvider>
    );

    expect(screen.queryByText("Bill 42/2024")).not.toBeInTheDocument();
  });

  it("shows the bill number, type, and status", () => {
    renderModal();

    expect(screen.getByRole("heading", { name: "Bill 42/2024" })).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("First Stage")).toBeInTheDocument();
  });

  it("shows the sponsor", () => {
    renderModal();
    expect(screen.getByText("Micheál Martin")).toBeInTheDocument();
  });

  it("shows an em dash when sponsor is empty", () => {
    renderModal({ bill: buildBill({ sponsor: "" }) });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows the English long title by default", () => {
    renderModal();
    expect(screen.getByText("Long English Title")).toBeInTheDocument();
  });

  it("falls back to the English short title when no long title exists", () => {
    renderModal({ bill: buildBill({ longTitleEn: "", shortTitleEn: "Short EN Fallback" }) });
    expect(screen.getByText("Short EN Fallback")).toBeInTheDocument();
  });

  it("shows a placeholder message when neither English title exists", () => {
    renderModal({ bill: buildBill({ longTitleEn: "", shortTitleEn: "" }) });
    expect(screen.getByText("No English title available.")).toBeInTheDocument();
  });

  it("switches to the Gaeilge tab and shows the Gaeilge title", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("tab", { name: "Gaeilge" }));

    expect(screen.getByText("Long Gaeilge Title")).toBeInTheDocument();
    expect(screen.queryByText("Long English Title")).not.toBeInTheDocument();
  });

  it("falls back to the Gaeilge placeholder when no Gaeilge title exists", async () => {
    const user = userEvent.setup();
    renderModal({ bill: buildBill({ longTitleGa: "", shortTitleGa: "" }) });

    await user.click(screen.getByRole("tab", { name: "Gaeilge" }));

    expect(screen.getByText("Níl teideal Gaeilge ar fáil.")).toBeInTheDocument();
  });

  it("calls onClose and resets to the English tab when the close button is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole("tab", { name: "Gaeilge" }));
    expect(screen.getByText("Long Gaeilge Title")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("toggles favourite state when the favourite button is clicked", async () => {
    const user = userEvent.setup();
    renderModal();

    const favouriteButton = screen.getByRole("button", { name: "Add 42/2024 to favourites" });
    await user.click(favouriteButton);

    expect(
      screen.getByRole("button", { name: "Remove 42/2024 from favourites" })
    ).toBeInTheDocument();
  });
});
