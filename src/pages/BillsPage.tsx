import { Box, Typography } from "@mui/material";
import { BillsTable } from "@/components/table/BillsTable";

export function BillsPage() {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }} gutterBottom>
          Legislation
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Browse and track bills from the Houses of the Oireachtas. Click any row to view full
          details. Star a bill to save it to your favourites.
        </Typography>
      </Box>

      <BillsTable />
    </Box>
  );
}
