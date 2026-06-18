import { Box, Typography } from "@mui/material";
import { useState } from "react";
import { BillModal } from "@/components/modal/BillModal";
import { BillsTable } from "@/components/table/BillsTable";
import type { Bill } from "@/types";

export function BillsPage() {
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function handleRowClick(bill: Bill) {
    setSelectedBill(bill);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
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

      <BillsTable onRowClick={handleRowClick} favouritesOnly={false} />

      <BillModal bill={selectedBill} open={modalOpen} onClose={handleModalClose} />
    </Box>
  );
}
