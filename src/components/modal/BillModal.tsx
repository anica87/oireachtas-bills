import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { FavouriteButton } from "@/components/favorite/FavouriteButton";
import { useFavourites } from "@/context/FavouritesContext";
import type { Bill } from "@/types";

interface BillModalProps {
  bill: Bill | null;
  open: boolean;
  onClose: () => void;
}

export function BillModal({ bill, open, onClose }: BillModalProps) {
  const [tab, setTab] = useState<"en" | "ga">("en");
  const { isFavourite, toggle } = useFavourites();

  function handleClose() {
    setTab("en");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      {bill && (
        <>
          <DialogTitle
            component="div"
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 1,
              pr: 1,
            }}
          >
            <Box>
              <Typography variant="h6" component="h2" fontWeight={700}>
                Bill {bill.billNoDisplay}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                <Chip label={bill.billType} size="small" variant="outlined" />
                <Chip label={bill.status} size="small" />
              </Stack>
            </Box>

            <Stack direction="row" alignItems="center" sx={{ flexShrink: 0 }}>
              <FavouriteButton
                isFavourite={isFavourite(bill.id)}
                onToggle={() => toggle(bill.id)}
                billTitle={bill.billNoDisplay}
              />
              <IconButton aria-label="Close" onClick={handleClose} size="small">
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>

          <Divider />

          <DialogContent>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              SPONSOR
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {bill.sponsor || "—"}
            </Typography>

            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab label="English" value="en" />
              <Tab label="Gaeilge" value="ga" />
            </Tabs>

            <Box sx={{ pt: 2 }}>
              {tab === "en" ? (
                <Typography>
                  {bill.longTitleEn || bill.shortTitleEn || "No English title available."}
                </Typography>
              ) : (
                <Typography>
                  {bill.longTitleGa || bill.shortTitleGa || "Níl teideal Gaeilge ar fáil."}
                </Typography>
              )}
            </Box>
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}
