/**
 * BillsTable — domain-specific table for the Oireachtas bills list.
 *
 * Composes the generic DataTable with:
 *  - Bill-specific column definitions
 *  - Multi-filter controls (type, status, house, search)
 *  - Client-side favourites filtering
 *  - Favourite toggle integration
 */

import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import { useCallback, useId, useMemo, useState } from "react";
import { BILL_STATUS_OPTIONS, BILL_TYPE_OPTIONS, ORIGIN_HOUSE_OPTIONS } from "@/api/bills";
import { FavouriteButton } from "@/components/favorite/FavouriteButton";
import { DataTable } from "@/components/table/DataTable";
import { useFavourites } from "@/context/FavouritesContext";
import { useBills } from "@/hooks/useBills";
import type { Bill, BillFilters, ColumnDef, PaginationState, SortState } from "@/types";

// ─── Status chip colour ───────────────────────────────────────────────────

function getStatusColor(
  status: string,
): "default" | "primary" | "success" | "warning" | "error" | "info" {
  const s = status.toLowerCase();
  if (s.includes("enact") || s.includes("passed") || s.includes("signed")) return "success";
  if (s.includes("lapsed") || s.includes("withdrawn") || s.includes("defeated")) return "error";
  if (s.includes("committee") || s.includes("report") || s.includes("second")) return "warning";
  if (s.includes("first")) return "primary";
  if (s.includes("current")) return "info";
  return "default";
}

// ─── Props ────────────────────────────────────────────────────────────────

interface BillsTableProps {
  onRowClick: (bill: Bill) => void;
  favouritesOnly?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────

export function BillsTable({ onRowClick, favouritesOnly = false }: BillsTableProps) {
  const filterLabelId = useId();

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const [filters, setFilters] = useState<BillFilters>({
    billType: "",
    billStatus: "",
    originHouse: "",
    search: "",
  });

  const [sortState, setSortState] = useState<SortState>({
    key: "",
    direction: false,
  });

  const { isFavourite, getStatus, toggle, favouriteIds } = useFavourites();

  const { data, isLoading, isFetching, error } = useBills({
    pagination,
    filters,
  });

  // Reset page when filters change
  const setFilter = useCallback(<K extends keyof BillFilters>(key: K, value: BillFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ billType: "", billStatus: "", originHouse: "", search: "" });
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  // Apply favourites-only filter client-side
  const displayData = useMemo(() => {
    const base = data?.data ?? [];
    return favouritesOnly ? base.filter((b) => favouriteIds.includes(b.id)) : base;
  }, [data, favouritesOnly, favouriteIds]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  // ── Column definitions ────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Bill>[]>(
    () => [
      {
        key: "favourite",
        header: "",
        sortKey: false,
        width: "48px",
        cell: (bill) => (
          <FavouriteButton
            isFavourite={isFavourite(bill.id)}
            status={getStatus(bill.id)}
            onToggle={() => void toggle(bill.id)}
            itemLabel={`Bill ${bill.billNoDisplay}`}
            size="small"
          />
        ),
      },
      {
        key: "billNoDisplay",
        header: "Bill No.",
        sortKey: "billNo",
        minWidth: "90px",
        cell: (bill) => (
          <Typography variant="body2" fontWeight={700} noWrap>
            {bill.billNoDisplay}
          </Typography>
        ),
      },
      {
        key: "billType",
        header: "Type",
        sortKey: "billType",
        minWidth: "120px",
        cell: (bill) => <Chip label={bill.billType} size="small" variant="outlined" />,
      },
      {
        key: "status",
        header: "Status",
        sortKey: "status",
        minWidth: "140px",
        cell: (bill) => (
          <Chip label={bill.status} size="small" color={getStatusColor(bill.status)} />
        ),
      },
      {
        key: "sponsor",
        header: "Sponsor",
        sortKey: false,
        minWidth: "160px",
        cell: (bill) => (
          <Tooltip title={bill.sponsor} arrow>
            <Typography variant="body2" noWrap sx={{ maxWidth: 200, display: "block" }}>
              {bill.sponsor}
            </Typography>
          </Tooltip>
        ),
      },
      {
        key: "originHouse",
        header: "House",
        sortKey: "originHouse",
        minWidth: "90px",
        cell: (bill) => (
          <Typography variant="body2" noWrap>
            {bill.originHouse || "—"}
          </Typography>
        ),
      },
    ],
    [isFavourite, getStatus, toggle],
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  const emptyState = (
    <Box sx={{ py: 2, textAlign: "center" }}>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {favouritesOnly ? "No favourited bills yet" : "No bills found"}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {favouritesOnly
          ? "Click the ★ on any bill to save it here"
          : hasActiveFilters
            ? "Try adjusting or clearing your filters"
            : "No data available"}
      </Typography>
    </Box>
  );

  return (
    <Box>
      {/* ── Filter bar ── */}
      {!favouritesOnly && (
        <Box sx={{ mb: 3 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
            {/* Search */}
            <TextField
              size="small"
              placeholder="Search by title, sponsor, bill no…"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              sx={{ minWidth: 240, flexGrow: 1 }}
              inputProps={{ "aria-label": "Search bills" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: filters.search ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setFilter("search", "")}
                      aria-label="Clear search"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />

            {/* Bill type */}
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id={`${filterLabelId}-type`}>Bill Type</InputLabel>
              <Select
                labelId={`${filterLabelId}-type`}
                value={filters.billType}
                label="Bill Type"
                onChange={(e) => setFilter("billType", e.target.value)}
              >
                {BILL_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Status */}
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id={`${filterLabelId}-status`}>Status</InputLabel>
              <Select
                labelId={`${filterLabelId}-status`}
                value={filters.billStatus}
                label="Status"
                onChange={(e) => setFilter("billStatus", e.target.value)}
              >
                {BILL_STATUS_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* House */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id={`${filterLabelId}-house`}>House</InputLabel>
              <Select
                labelId={`${filterLabelId}-house`}
                value={filters.originHouse}
                label="House"
                onChange={(e) => setFilter("originHouse", e.target.value)}
              >
                {ORIGIN_HOUSE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
              {filters.search && (
                <Chip
                  label={`Search: "${filters.search}"`}
                  size="small"
                  onDelete={() => setFilter("search", "")}
                  aria-label={`Remove search filter: ${filters.search}`}
                />
              )}
              {filters.billType && (
                <Chip
                  label={`Type: ${BILL_TYPE_OPTIONS.find((o) => o.value === filters.billType)?.label}`}
                  size="small"
                  onDelete={() => setFilter("billType", "")}
                />
              )}
              {filters.billStatus && (
                <Chip
                  label={`Status: ${filters.billStatus}`}
                  size="small"
                  onDelete={() => setFilter("billStatus", "")}
                />
              )}
              {filters.originHouse && (
                <Chip
                  label={`House: ${ORIGIN_HOUSE_OPTIONS.find((o) => o.value === filters.originHouse)?.label}`}
                  size="small"
                  onDelete={() => setFilter("originHouse", "")}
                />
              )}
              <Chip
                label="Clear all"
                size="small"
                variant="outlined"
                onClick={clearFilters}
                aria-label="Clear all active filters"
              />
            </Stack>
          )}
        </Box>
      )}

      <DataTable<Bill>
        columns={columns}
        data={displayData}
        rowCount={favouritesOnly ? favouriteIds.length : (data?.total ?? 0)}
        pagination={pagination}
        onPaginationChange={setPagination}
        sortState={sortState}
        onSortChange={setSortState}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRowClick={onRowClick}
        getRowKey={(bill) => bill.id}
        getRowAriaLabel={(bill) =>
          `Bill ${bill.billNoDisplay}: ${bill.shortTitleEn}. Type: ${bill.billType}. Status: ${bill.status}. Sponsor: ${bill.sponsor}`
        }
        emptyState={emptyState}
        aria-label={favouritesOnly ? "Favourited bills" : "Bills list"}
        rowsPerPageOptions={[10, 20, 50]}
      />
    </Box>
  );
}
