import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { IconButton, Tooltip } from "@mui/material";
import { memo } from "react";

export interface FavouriteButtonProps {
  isFavourite: boolean;
  onToggle: () => void;
  billTitle?: string;
}

export const FavouriteButton = memo(function FavouriteButton({
  isFavourite,
  onToggle,
  billTitle = "bill",
}: FavouriteButtonProps) {
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onToggle();
  }

  return (
    <Tooltip title={isFavourite ? "Remove from favourites" : "Add to favourites"} arrow>
      <IconButton
        aria-label={
          isFavourite ? `Remove ${billTitle} from favourites` : `Add ${billTitle} to favourites`
        }
        aria-pressed={isFavourite}
        onClick={handleClick}
        size="small"
        color={isFavourite ? "warning" : "default"}
        sx={{
          transition: "transform 0.15s ease",
          "&:hover": { transform: "scale(1.15)" },
        }}
      >
        {isFavourite ? (
          <StarIcon fontSize="small" aria-hidden="true" />
        ) : (
          <StarBorderIcon fontSize="small" aria-hidden="true" />
        )}
      </IconButton>
    </Tooltip>
  );
});
