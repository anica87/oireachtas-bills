/**
 * FavouriteButton — accessible, reusable, stateless/presentational component.
 *
 * Key principles:
 *  - Accessible: ARIA labels, roles, keyboard support
 *  - Reusable: no domain coupling, receives all state via props
 *  - Stateless/presentational: no internal state
 *  - Supports optimistic updates via parent-controlled `isFavourite`
 *  - Proper loading and error handling states
 */

import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { Box, CircularProgress, IconButton, Tooltip } from "@mui/material";
import { memo } from "react";
import type { FavouriteStatus } from "@/types";

// ─── Props ────────────────────────────────────────────────────────────────

export interface FavouriteButtonProps {
  /** Whether the item is currently favourited */
  isFavourite: boolean;
  /** Async status of the server sync */
  status?: FavouriteStatus;
  /** Called when the user toggles the favourite */
  onToggle: () => void;
  /** Accessible label for the item being favourited */
  itemLabel?: string;
  /** Size of the icon button */
  size?: "small" | "medium" | "large";
  /** Disable the button (e.g. when another operation is in progress) */
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────

/**
 * Pure presentational favourite toggle button.
 * Wrap with React.memo to prevent unnecessary re-renders in list contexts.
 */
export const FavouriteButton = memo(function FavouriteButton({
  isFavourite,
  status = "idle",
  onToggle,
  itemLabel = "item",
  size = "medium",
  disabled = false,
}: FavouriteButtonProps) {
  const isLoading = status === "loading";
  const hasError = status === "error";

  const ariaLabel = isFavourite
    ? `Remove ${itemLabel} from favourites`
    : `Add ${itemLabel} to favourites`;

  const tooltipTitle = hasError
    ? "Failed to update — click to retry"
    : isFavourite
      ? "Remove from favourites"
      : "Add to favourites";

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation(); // prevent row click when inside a table row
    if (!isLoading && !disabled) {
      onToggle();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (!isLoading && !disabled) {
        onToggle();
      }
    }
  }

  return (
    <Tooltip title={tooltipTitle} arrow>
      <Box
        component="span"
        sx={{ display: "inline-flex" }}
        // Tooltip needs a non-disabled child element for accessibility
      >
        <IconButton
          aria-label={ariaLabel}
          aria-pressed={isFavourite}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          size={size}
          disabled={disabled || isLoading}
          color={hasError ? "error" : isFavourite ? "warning" : "default"}
          sx={{
            transition: "transform 0.15s ease, color 0.2s ease",
            "&:hover": { transform: "scale(1.15)" },
            "&:active": { transform: "scale(0.95)" },
          }}
        >
          {isLoading ? (
            <CircularProgress
              size={size === "small" ? 16 : 20}
              color="inherit"
              aria-hidden="true"
            />
          ) : hasError ? (
            <ErrorOutlineIcon fontSize={size} aria-hidden="true" />
          ) : isFavourite ? (
            <StarIcon fontSize={size} aria-hidden="true" />
          ) : (
            <StarBorderIcon fontSize={size} aria-hidden="true" />
          )}
        </IconButton>
      </Box>
    </Tooltip>
  );
});
