/**
 * Integration tests for the generic DataTable component.
 *
 * Verifies the table mechanics work correctly — header rendering,
 * row data, loading skeleton, empty state, error state, row click,
 * keyboard activation, and pagination controls.
 */

import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "@/components/table/DataTable";
import { renderWithProviders } from "@/test/utils";
import type { ColumnDef, PaginationState } from "@/types";

// ─── Fixture ──────────────────────────────────────────────────────────────

interface Row {
  id: string;
  name: string;
  value: number;
}

const columns: ColumnDef<Row>[] = [
  {
    key: "name",
    header: "Name",
    cell: (row) => row.name,
  },
  {
    key: "value",
    header: "Value",
    cell: (row) => String(row.value),
  },
];

const rows: Row[] = [
  { id: "1", name: "Alpha", value: 10 },
  { id: "2", name: "Beta", value: 20 },
];

const defaultPagination: PaginationState = { pageIndex: 0, pageSize: 10 };

describe("DataTable", () => {
  const onPaginationChange = vi.fn();
  const onRowClick = vi.fn();

  beforeEach(() => {
    onPaginationChange.mockClear();
    onRowClick.mockClear();
  });

  it("renders column headers", () => {
    renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        rowCount={2}
        pagination={defaultPagination}
        onPaginationChange={onPaginationChange}
        getRowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
  });

  it("renders row data", () => {
    renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        rowCount={2}
        pagination={defaultPagination}
        onPaginationChange={onPaginationChange}
        getRowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    // Value cells are inside <td> elements
    const cells = document.querySelectorAll("td");
    const texts = Array.from(cells).map((c) => c.textContent);
    expect(texts).toContain("10");
  });

  it("shows skeleton rows while loading", () => {
    renderWithProviders(
      <DataTable
        columns={columns}
        data={[]}
        rowCount={0}
        pagination={{ pageIndex: 0, pageSize: 5 }}
        onPaginationChange={onPaginationChange}
        getRowKey={(r) => r.id}
        isLoading
      />,
    );
    // Skeleton rows are hidden from assistive tech; check DOM
    const skeletons = document.querySelectorAll(".MuiSkeleton-root");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows custom empty state when data is empty", () => {
    renderWithProviders(
      <DataTable
        columns={columns}
        data={[]}
        rowCount={0}
        pagination={defaultPagination}
        onPaginationChange={onPaginationChange}
        getRowKey={(r) => r.id}
        emptyState={<span>Nothing here</span>}
      />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("shows default empty state when no emptyState prop", () => {
    renderWithProviders(
      <DataTable
        columns={columns}
        data={[]}
        rowCount={0}
        pagination={defaultPagination}
        onPaginationChange={onPaginationChange}
        getRowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("shows error state with message and role=alert", () => {
    renderWithProviders(
      <DataTable
        columns={columns}
        data={[]}
        rowCount={0}
        pagination={defaultPagination}
        onPaginationChange={onPaginationChange}
        getRowKey={(r) => r.id}
        error={new Error("Network failure")}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/network failure/i)).toBeInTheDocument();
  });

  it("calls onRowClick when a row is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        rowCount={2}
        pagination={defaultPagination}
        onPaginationChange={onPaginationChange}
        getRowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    await user.click(screen.getByText("Alpha"));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("activates row click on Enter key", () => {
    renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        rowCount={2}
        pagination={defaultPagination}
        onPaginationChange={onPaginationChange}
        getRowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    // Row elements have role="button" when clickable
    const rowEls = screen.getAllByRole("button").filter((el) => el.tagName === "TR");
    fireEvent.keyDown(rowEls[0], { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("activates row click on Space key", () => {
    renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        rowCount={2}
        pagination={defaultPagination}
        onPaginationChange={onPaginationChange}
        getRowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    const rowEls = screen.getAllByRole("button").filter((el) => el.tagName === "TR");
    fireEvent.keyDown(rowEls[0], { key: " " });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("has an accessible table label", () => {
    renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        rowCount={2}
        pagination={defaultPagination}
        onPaginationChange={onPaginationChange}
        getRowKey={(r) => r.id}
        aria-label="Test table"
      />,
    );
    expect(screen.getByRole("table", { name: "Test table" })).toBeInTheDocument();
  });

  it("renders accessible pagination navigation buttons", () => {
    renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        rowCount={50}
        pagination={defaultPagination}
        onPaginationChange={onPaginationChange}
        getRowKey={(r) => r.id}
      />,
    );
    expect(screen.getByLabelText("Previous page")).toBeInTheDocument();
    expect(screen.getByLabelText("Next page")).toBeInTheDocument();
  });

  it("does not make rows clickable when onRowClick is absent", () => {
    renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        rowCount={2}
        pagination={defaultPagination}
        onPaginationChange={onPaginationChange}
        getRowKey={(r) => r.id}
      />,
    );
    // No TR should have role="button"
    const rowButtons = screen.queryAllByRole("button").filter((el) => el.tagName === "TR");
    expect(rowButtons).toHaveLength(0);
  });
});
