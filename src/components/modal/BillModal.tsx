/**
 * BillModal — accessible dialog with tabbed English / Gaeilge views.
 *
 * ARIA: role="dialog", aria-modal, aria-labelledby, focus management.
 * Tabs: role="tabpanel", aria-controls, aria-labelledby.
 */

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
import { useId, useState } from "react";
import { FavouriteButton } from "@/components/favorite/FavouriteButton";
import { useFavourites } from "@/context/FavouritesContext";
import type { Bill } from "@/types";

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
  id: string;
  labelledById: string;
}

function TabPanel({ children, value, index, id, labelledById }: TabPanelProps) {
  const isActive = value === index;
  return (
    <Box
      role="tabpanel"
      hidden={!isActive}
      id={id}
      aria-labelledby={labelledById}
      tabIndex={isActive ? 0 : -1}
      sx={{ py: 2, outline: "none" }}
    >
      {isActive && children}
    </Box>
  );
}

export interface BillModalProps {
  bill: Bill | null;
  open: boolean;
  onClose: () => void;
}

export function BillModal({ bill, open, onClose }: BillModalProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const uid = useId();
  const { isFavourite, getStatus, toggle } = useFavourites();

  const titleId = `${uid}-title`;
  const tabEnId = `${uid}-tab-en`;
  const tabGaId = `${uid}-tab-ga`;
  const panelEnId = `${uid}-panel-en`;
  const panelGaId = `${uid}-panel-ga`;

  function handleClose() {
    setTabIndex(0);
    onClose();
  }

  if (!bill) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby={titleId}
      aria-modal="true"
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle
        id={titleId}
        component="div"
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1,
          pr: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" component="h2" fontWeight={700}>
            Bill {bill.billNoDisplay}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
            <Chip label={bill.billType} size="small" color="primary" variant="outlined" />
            <Chip label={bill.status} size="small" color="success" variant="outlined" />
            {bill.originHouse && <Chip label={bill.originHouse} size="small" variant="outlined" />}
          </Stack>
        </Box>

        <Stack direction="row" alignItems="center" sx={{ flexShrink: 0 }}>
          <FavouriteButton
            isFavourite={isFavourite(bill.id)}
            status={getStatus(bill.id)}
            onToggle={() => void toggle(bill.id)}
            itemLabel={`Bill ${bill.billNoDisplay}`}
          />
          <IconButton aria-label="Close bill details" onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <Divider />

      <DialogContent>
        <Stack direction="row" spacing={3} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              SPONSOR
            </Typography>
            <Typography variant="body2">{bill.sponsor}</Typography>
          </Box>
          {bill.originHouse && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                HOUSE
              </Typography>
              <Typography variant="body2">{bill.originHouse}</Typography>
            </Box>
          )}
        </Stack>

        <Box>
          <Tabs
            value={tabIndex}
            onChange={(_, v: number) => setTabIndex(v)}
            aria-label="Bill title language"
            variant="fullWidth"
          >
            <Tab
              id={tabEnId}
              aria-controls={panelEnId}
              label="English"
              aria-selected={tabIndex === 0}
            />
            <Tab
              id={tabGaId}
              aria-controls={panelGaId}
              label="Gaeilge"
              aria-selected={tabIndex === 1}
            />
          </Tabs>

          <TabPanel value={tabIndex} index={0} id={panelEnId} labelledById={tabEnId}>
            <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
              {bill.shortTitleEn || bill.longTitleEn || "No English title available."}
            </Typography>
            {bill.longTitleEn && bill.longTitleEn !== bill.shortTitleEn && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  FULL TITLE
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {bill.longTitleEn}
                </Typography>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={tabIndex} index={1} id={panelGaId} labelledById={tabGaId}>
            <Typography
              variant="body1"
              sx={{
                lineHeight: 1.7,
                fontStyle: bill.shortTitleGa ? "normal" : "italic",
              }}
            >
              {bill.shortTitleGa || bill.longTitleGa || "Níl teideal Gaeilge ar fáil."}
            </Typography>
            {bill.longTitleGa && bill.longTitleGa !== bill.shortTitleGa && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  LÁNTEIDEAL
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {bill.longTitleGa}
                </Typography>
              </Box>
            )}
          </TabPanel>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
