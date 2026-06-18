import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { FavouriteButton } from "@/components/favorite/FavouriteButton";
import { BillModal } from "@/components/modal/BillModal";
import { useFavourites } from "@/context/FavouritesContext";
import { useBills } from "@/hooks/useBills";
import type { Bill } from "@/types";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function getStatusColor(status: string): "default" | "success" | "error" | "warning" | "primary" {
  const s = status.toLowerCase();
  if (s.includes("enact") || s.includes("passed") || s.includes("signed")) return "success";
  if (s.includes("lapsed") || s.includes("withdrawn") || s.includes("defeated")) return "error";
  if (s.includes("committee") || s.includes("second")) return "warning";
  if (s.includes("first")) return "primary";
  return "default";
}

export function BillsTable() {
  const { isFavourite, toggle, favouriteIds } = useFavourites();

  const [tab, setTab] = useState<"all" | "favourites">("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const { data, isLoading, error } = useBills({ page, pageSize, typeFilter });

  const bills = data?.bills ?? [];
  const total = data?.total ?? 0;
  const billTypes = Array.from(new Set(bills.map((b) => b.billType)));

  const rows = tab === "favourites"
    ? bills.filter((b) => favouriteIds.includes(b.id))
    : bills;

  function handleTabChange(_: React.SyntheticEvent, value: "all" | "favourites") {
    setTab(value);
    setPage(0);
  }

  function handleTypeFilter(value: string) {
    setTypeFilter(value);
    setPage(0);
  }

  const colSpan = 5;

  return (
    <Paper elevation={2}>
      <Tabs
        value={tab}
        onChange={handleTabChange}
        sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
      >
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
            onChange={(e) => handleTypeFilter(e.target.value)}
          >
            <MenuItem value="">All types</MenuItem>
            {billTypes.map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
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
                <TableCell colSpan={colSpan} align="center" sx={{ py: 4 }}>
                  <Typography color="error" variant="body2">
                    Failed to load: {error.message}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              Array.from({ length: pageSize }, (_, i) => (
                <TableRow key={i} aria-hidden="true">
                  {Array.from({ length: colSpan }, (_, j) => (
                    <TableCell key={j}><Skeleton variant="text" width="80%" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} align="center" sx={{ py: 4 }}>
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
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedBill(bill); }}
                  sx={{ cursor: "pointer", "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: "-2px" } }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <FavouriteButton
                      isFavourite={isFavourite(bill.id)}
                      onToggle={() => toggle(bill.id)}
                      billTitle={bill.billNoDisplay}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{bill.billNoDisplay}</Typography>
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

      <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={pageSize}
        rowsPerPageOptions={PAGE_SIZE_OPTIONS}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
      />

      <BillModal bill={selectedBill} open={!!selectedBill} onClose={() => setSelectedBill(null)} />
    </Paper>
  );
}
