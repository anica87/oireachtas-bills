/**
 * Integration tests for BillModal.
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BillModal } from "@/components/modal/BillModal";
import { renderWithProviders } from "@/test/utils";
import type { Bill } from "@/types";

const mockBill: Bill = {
  id: "bill-uri-1",
  billNo: "42",
  billYear: "2024",
  billNoDisplay: "42/2024",
  billType: "Public",
  status: "First Stage",
  shortTitleEn: "Education Reform Bill 2024",
  shortTitleGa: "Bille Athchóirithe Oideachais 2024",
  longTitleEn: "An act to reform the education system",
  longTitleGa: "Acht chun an córas oideachais a athchóiriú",
  sponsor: "Minister for Education",
  originHouse: "Dáil",
  uri: "bill-uri-1",
};

describe("BillModal", () => {
  it("renders bill number and chips in header", () => {
    renderWithProviders(<BillModal bill={mockBill} open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/bill 42\/2024/i)).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("First Stage")).toBeInTheDocument();
  });

  it("shows English title in the first (default) tab", () => {
    renderWithProviders(<BillModal bill={mockBill} open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Education Reform Bill 2024")).toBeInTheDocument();
  });

  it("switches to Gaeilge tab and shows Irish title", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BillModal bill={mockBill} open={true} onClose={vi.fn()} />);
    await user.click(screen.getByRole("tab", { name: /gaeilge/i }));
    expect(screen.getByText("Bille Athchóirithe Oideachais 2024")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<BillModal bill={mockBill} open={true} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /close bill details/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has an accessible favourite button with correct aria-pressed", () => {
    renderWithProviders(<BillModal bill={mockBill} open={true} onClose={vi.fn()} />);
    const favBtn = screen.getByRole("button", {
      name: /add bill 42\/2024 to favourites/i,
    });
    expect(favBtn).toBeInTheDocument();
    expect(favBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("shows sponsor information", () => {
    renderWithProviders(<BillModal bill={mockBill} open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/minister for education/i)).toBeInTheDocument();
  });

  it("shows origin house information", () => {
    renderWithProviders(<BillModal bill={mockBill} open={true} onClose={vi.fn()} />);
    // "Dáil" appears in both the chip and the metadata section
    const elements = screen.getAllByText(/dáil/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  it("renders nothing when bill is null", () => {
    renderWithProviders(<BillModal bill={null} open={true} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not render dialog content when closed", () => {
    renderWithProviders(<BillModal bill={mockBill} open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
