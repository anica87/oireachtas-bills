/**
 * BillsPage — main application view.
 *
 * Combines the bills table (all bills / favourites tabs),
 * filter controls, and the bill detail modal.
 */

import ListAltIcon from "@mui/icons-material/ListAlt";
import StarIcon from "@mui/icons-material/Star";
import { Badge, Box, Tab, Tabs, Typography } from "@mui/material";
import { useState } from "react";
import { BillModal } from "@/components/modal/BillModal";
import { BillsTable } from "@/components/table/BillsTable";
import { useFavourites } from "@/context/FavouritesContext";
import type { Bill } from "@/types";

export function BillsPage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { favouriteIds } = useFavourites();

  function handleRowClick(bill: Bill) {
    setSelectedBill(bill);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    // Keep the bill in state briefly so modal exit animation completes cleanly
    setTimeout(() => setSelectedBill(null), 300);
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" fontWeight={700} gutterBottom>
          Legislation
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Browse and track bills from the Houses of the Oireachtas. Click any row to view full
          details. Star a bill to save it to your favourites.
        </Typography>
      </Box>

      {/* Main tabs: All Bills / Favourites */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, v: number) => setTabIndex(v)}
          aria-label="Bills view tabs"
        >
          <Tab
            id="tab-all"
            aria-controls="tabpanel-all"
            label="All Bills"
            icon={<ListAltIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            id="tab-favourites"
            aria-controls="tabpanel-favourites"
            label={
              <Badge
                badgeContent={favouriteIds.length}
                color="warning"
                max={99}
                aria-label={`${favouriteIds.length} favourited bills`}
              >
                Favourites&nbsp;&nbsp;
              </Badge>
            }
            icon={<StarIcon fontSize="small" />}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* All Bills tab */}
      <Box role="tabpanel" id="tabpanel-all" aria-labelledby="tab-all" hidden={tabIndex !== 0}>
        {tabIndex === 0 && <BillsTable onRowClick={handleRowClick} favouritesOnly={false} />}
      </Box>

      {/* Favourites tab */}
      <Box
        role="tabpanel"
        id="tabpanel-favourites"
        aria-labelledby="tab-favourites"
        hidden={tabIndex !== 1}
      >
        {tabIndex === 1 && <BillsTable onRowClick={handleRowClick} favouritesOnly={true} />}
      </Box>

      {/* Bill detail modal */}
      <BillModal bill={selectedBill} open={modalOpen} onClose={handleModalClose} />
    </Box>
  );
}
