import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import {
  Box,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { FavouriteButton } from "@/components/favorite/FavouriteButton";
import { BillModal } from "@/components/modal/BillModal";
import { useFavourites } from "@/context/FavouritesContext";
import { useBills, useBillTypes } from "@/hooks/useBills";
import type { Bill } from "@/types";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const TABLE_COLUMNS = 5;

type TabValue = "all" | "favourites";

function getStatusColor(status: string): "default" | "success" | "error" | "warning" | "primary" {
  const s = status.toLowerCase();
  if (s.includes("enact") || s.includes("passed") || s.includes("signed")) return "success";
  if (s.includes("lapsed") || s.includes("withdrawn") || s.includes("defeated")) return "error";
  if (s.includes("committee") || s.includes("second")) return "warning";
  if (s.includes("first")) return "primary";
  return "default";
}

interface PaginationState {
  page: number;
  pageSize: PageSize;
}

interface TablePaginationControlsProps {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

function TablePaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: TablePaginationControlsProps) {
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="flex-end"
      spacing={1}
      sx={{ px: 2, py: 1 }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
        Rows per page:
      </Typography>
      <Select
        size="small"
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
        sx={{ fontSize: 14 }}
      >
        {PAGE_SIZE_OPTIONS.map((n) => (
          <MenuItem key={n} value={n}>
            {n}
          </MenuItem>
        ))}
      </Select>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mx: 2, minWidth: 80, textAlign: "center" }}
      >
        {from}–{to} of {total}
      </Typography>

      <Tooltip title="First page">
        <span>
          <IconButton size="small" onClick={() => onPageChange(0)} disabled={page === 0}>
            <FirstPageIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Previous page">
        <span>
          <IconButton size="small" onClick={() => onPageChange(page - 1)} disabled={page === 0}>
            <NavigateBeforeIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Next page">
        <span>
          <IconButton
            size="small"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= lastPage}
          >
            <NavigateNextIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Last page">
        <span>
          <IconButton size="small" onClick={() => onPageChange(lastPage)} disabled={page >= lastPage}>
            <LastPageIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

export function BillsTable() {
  const { isFavourite, toggle, favourites, favouriteIds } = useFavourites();
  const billTypes = useBillTypes();

  const [tab, setTab] = useState<TabValue>("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // each tab keeps its own page/pageSize so switching tabs doesn't reset the other
  const [allPagination, setAllPagination] = useState<PaginationState>({ page: 0, pageSize: 20 });
  const [favPagination, setFavPagination] = useState<PaginationState>({ page: 0, pageSize: 20 });

  const pagination = tab === "all" ? allPagination : favPagination;
  const setPagination = tab === "all" ? setAllPagination : setFavPagination;

  const { data, isLoading, error } = useBills({
    page: allPagination.page,
    pageSize: allPagination.pageSize,
    typeFilter,
  });

  const bills = data?.bills ?? [];
  const total = data?.total ?? 0;

  // favourites live entirely in context, so filter/paginate them client-side
  const filteredFavourites = typeFilter
    ? favourites.filter((b) => b.billType === typeFilter)
    : favourites;

  const favouritesPage = filteredFavourites.slice(
    favPagination.page * favPagination.pageSize,
    (favPagination.page + 1) * favPagination.pageSize
  );

  const rows = tab === "favourites" ? favouritesPage : bills;
  const rowTotal = tab === "favourites" ? filteredFavourites.length : total;

  function handleTabChange(_: React.SyntheticEvent, value: TabValue) {
    setTab(value);
  }

  function handlePageChange(page: number) {
    setPagination((prev) => ({ ...prev, page }));
  }

  function handlePageSizeChange(pageSize: PageSize) {
    setPagination({ page: 0, pageSize });
  }

  function handleTypeFilterChange(value: string) {
    setTypeFilter(value);
    setAllPagination((p) => ({ ...p, page: 0 }));
    setFavPagination((p) => ({ ...p, page: 0 }));
  }

  return (
    <Paper elevation={2}>
      <Tabs value={tab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}>
        <Tab label="All Bills" value="all" />
        <Tab
          label={`Favourites${favouriteIds.length > 0 ? ` (${favouriteIds.length})` : ""}`}
          value="favourites"
        />
      </Tabs>

      <Box sx={{ px: 2, pt: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Bill type</InputLabel>
          <Select
            value={typeFilter}
            label="Bill type"
            onChange={(e) => handleTypeFilterChange(e.target.value)}
          >
            <MenuItem value="">All types</MenuItem>
            {billTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <TableContainer>
        <Table size="small" aria-label="Bills table">
          <TableHead>
            <TableRow sx={{ bgcolor: "grey.50" }}>
              <TableCell padding="checkbox" />
              <TableCell>Bill number</TableCell>
              <TableCell>Bill type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Sponsor</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={TABLE_COLUMNS} align="center" sx={{ py: 4 }}>
                  <Typography color="error" variant="body2">
                    Failed to load: {error.message}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              Array.from({ length: pagination.pageSize }).map((_, i) => (
                <TableRow key={i} aria-hidden="true">
                  {Array.from({ length: TABLE_COLUMNS }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton variant="text" width="80%" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={TABLE_COLUMNS} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary" variant="body2">
                    {tab === "favourites"
                      ? "No favourited bills yet — click a star to save one."
                      : "No bills match the current filter."}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((bill) => (
                <TableRow
                  key={bill.id}
                  hover
                  tabIndex={0}
                  onClick={() => setSelectedBill(bill)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedBill(bill);
                  }}
                  sx={{
                    cursor: "pointer",
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                      outlineOffset: "-2px",
                    },
                  }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <FavouriteButton
                      isFavourite={isFavourite(bill.id)}
                      onToggle={() => toggle(bill)}
                      billTitle={bill.billNoDisplay}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {bill.billNoDisplay}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={bill.billType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip label={bill.status} size="small" color={getStatusColor(bill.status)} />
                  </TableCell>
                  <TableCell>{bill.sponsor || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePaginationControls
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={rowTotal}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <BillModal bill={selectedBill} open={!!selectedBill} onClose={() => setSelectedBill(null)} />
    </Paper>
  );
}
