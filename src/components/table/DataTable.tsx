/**
 * DataTable — a generic, composable, accessible data-rendering engine.
 *
 * Built from scratch without TanStack Table. Separates table mechanics
 * (column rendering, sorting indicators, pagination, loading/error/empty states)
 * from domain-specific business logic.
 *
 * Generic over TData so it can be used with any row type across projects.
 *
 * Design goals:
 *  - Generic: DataTable<Bill>, DataTable<Member>, DataTable<Vote> etc.
 *  - Composable: column definitions passed in; no domain knowledge inside
 *  - Accessible: full ARIA table semantics, keyboard navigation, live regions
 *  - Performant: stable column/row keys, memoised sort handler
 *  - Reusable: zero coupling to the Oireachtas domain
 */

import {
  Box,
  CircularProgress,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import { memo, type ReactNode, useCallback, useMemo } from "react";
import type { ColumnDef, PaginationState, SortState } from "@/types";

// ─── Props ────────────────────────────────────────────────────────────────

export interface DataTableProps<TData extends object> {
  /** Column definitions — pure configuration, no domain logic */
  columns: ColumnDef<TData>[];
  /** Current page of row data */
  data: TData[];
  /** Total rows across all pages (for server-side pagination display) */
  rowCount: number;
  /** Controlled pagination */
  pagination: PaginationState;
  onPaginationChange: (next: PaginationState) => void;
  /** Controlled sort state */
  sortState?: SortState;
  onSortChange?: (next: SortState) => void;
  /** Loading / fetching / error states */
  isLoading?: boolean;
  isFetching?: boolean;
  error?: Error | null;
  /** Slot rendered when data is empty */
  emptyState?: ReactNode;
  /** Accessible label for the <table> element */
  "aria-label"?: string;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Produce an aria-label per row for screen readers */
  getRowAriaLabel?: (row: TData) => string;
  /** Unique key per row — required for stable rendering */
  getRowKey: (row: TData) => string;
  /** Row-per-page options shown in the pagination control */
  rowsPerPageOptions?: number[];
}

// ─── Skeleton rows ─────────────────────────────────────────────────────────

interface SkeletonRowsProps {
  columnCount: number;
  rowCount: number;
}

const SkeletonRows = memo(function SkeletonRows({ columnCount, rowCount }: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rowCount }, (_, rowIdx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no stable id
        <TableRow key={`skeleton-row-${rowIdx}`} aria-hidden="true">
          {Array.from({ length: columnCount }, (_, colIdx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cells have no stable id
            <TableCell key={`skeleton-cell-${colIdx}`}>
              <Skeleton variant="text" width="75%" height={20} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
});

// ─── Component ────────────────────────────────────────────────────────────

/**
 * Generic DataTable.
 *
 * @example
 * ```tsx
 * <DataTable<Bill>
 *   columns={billColumns}
 *   data={bills}
 *   rowCount={total}
 *   pagination={pagination}
 *   onPaginationChange={setPagination}
 *   getRowKey={(bill) => bill.id}
 * />
 * ```
 */
export function DataTable<TData extends object>({
  columns,
  data,
  rowCount,
  pagination,
  onPaginationChange,
  sortState,
  onSortChange,
  isLoading = false,
  isFetching = false,
  error = null,
  emptyState,
  "aria-label": ariaLabel = "Data table",
  onRowClick,
  getRowAriaLabel,
  getRowKey,
  rowsPerPageOptions = [10, 20, 50],
}: DataTableProps<TData>) {
  const isClickable = !!onRowClick;

  // ── Sort handler ──────────────────────────────────────────────────────────
  const handleSort = useCallback(
    (colKey: string) => {
      if (!onSortChange) return;
      const isSameCol = sortState?.key === colKey;
      const nextDirection = !isSameCol ? "asc" : sortState?.direction === "asc" ? "desc" : false;

      if (nextDirection === false) {
        onSortChange({ key: "", direction: false });
      } else {
        onSortChange({ key: colKey, direction: nextDirection });
      }
    },
    [sortState, onSortChange],
  );

  // ── Pagination helpers ────────────────────────────────────────────────────
  const handlePageChange = useCallback(
    (_: unknown, newPage: number) => {
      onPaginationChange({ ...pagination, pageIndex: newPage });
    },
    [pagination, onPaginationChange],
  );

  const handleRowsPerPageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onPaginationChange({
        pageIndex: 0,
        pageSize: parseInt(e.target.value, 10),
      });
    },
    [onPaginationChange],
  );

  // ── Row keyboard handler ──────────────────────────────────────────────────
  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent, row: TData) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onRowClick?.(row);
      }
    },
    [onRowClick],
  );

  // ── Visible columns (memoised) ────────────────────────────────────────────
  const visibleColumns = useMemo(() => columns, [columns]);

  return (
    <Box sx={{ position: "relative" }}>
      {/* Background-fetch indicator */}
      {isFetching && !isLoading && (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 0,
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
          role="status"
          aria-live="polite"
          aria-label="Refreshing data"
        >
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            Refreshing…
          </Typography>
        </Box>
      )}

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: 2, overflowX: "auto" }}
      >
        <Table
          aria-label={ariaLabel}
          aria-busy={isLoading}
          aria-rowcount={rowCount}
          sx={{ minWidth: 600 }}
          size="medium"
        >
          {/* ── Head ── */}
          <TableHead>
            <TableRow sx={{ bgcolor: "grey.50" }}>
              {visibleColumns.map((col) => {
                const canSort = col.sortKey !== false && onSortChange !== undefined;
                const effectiveSortKey = col.sortKey ?? col.key;
                const isActive = canSort && sortState?.key === effectiveSortKey;
                const direction = isActive ? (sortState?.direction as "asc" | "desc") : "asc";

                return (
                  <TableCell
                    key={col.key}
                    sortDirection={isActive ? direction : false}
                    sx={{
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      minWidth: col.minWidth,
                      width: col.width,
                    }}
                  >
                    {canSort ? (
                      <TableSortLabel
                        active={isActive}
                        direction={direction}
                        onClick={() => handleSort(effectiveSortKey)}
                        aria-label={`Sort by ${col.header}`}
                      >
                        {col.header}
                        {isActive && (
                          <Box component="span" sx={visuallyHidden}>
                            {direction === "desc" ? "sorted descending" : "sorted ascending"}
                          </Box>
                        )}
                      </TableSortLabel>
                    ) : (
                      col.header
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>

          {/* ── Body ── */}
          <TableBody>
            {isLoading ? (
              <SkeletonRows columnCount={visibleColumns.length} rowCount={pagination.pageSize} />
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length}
                  align="center"
                  sx={{ py: 6 }}
                  role="alert"
                >
                  <Typography color="error" variant="body2">
                    Failed to load: {error.message}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} align="center" sx={{ py: 6 }}>
                  {emptyState ?? (
                    <Typography color="text.secondary" variant="body2">
                      No results found
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={getRowKey(row)}
                  hover={isClickable}
                  onClick={isClickable ? () => onRowClick(row) : undefined}
                  onKeyDown={isClickable ? (e) => handleRowKeyDown(e, row) : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  role={isClickable ? "button" : "row"}
                  aria-label={getRowAriaLabel?.(row)}
                  sx={
                    isClickable
                      ? {
                          cursor: "pointer",
                          "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: "primary.main",
                            outlineOffset: "-2px",
                          },
                        }
                      : undefined
                  }
                >
                  {visibleColumns.map((col) => (
                    <TableCell key={col.key}>{col.cell(row)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Pagination ── */}
      <TablePagination
        component="div"
        count={rowCount}
        page={pagination.pageIndex}
        rowsPerPage={pagination.pageSize}
        rowsPerPageOptions={rowsPerPageOptions}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        slotProps={{
          actions: {
            previousButton: {
              "aria-label": "Previous page",
            } as React.ButtonHTMLAttributes<HTMLButtonElement>,
            nextButton: {
              "aria-label": "Next page",
            } as React.ButtonHTMLAttributes<HTMLButtonElement>,
          },
        }}
      />
    </Box>
  );
}
