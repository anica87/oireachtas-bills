import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────

export type FavouriteStatus = "idle" | "loading" | "success" | "error";

interface FavouritesState {
  entries: Record<string, { isFavourite: boolean; status: FavouriteStatus }>;
}

// ─── Mock server call ──────────────────────────────────────────────────────

function mockServerToggle(billId: string, isFavourite: boolean) {
  console.log(`[server] ${isFavourite ? "FAV" : "UNFAV"} bill "${billId}" dispatched`);
}

// ─── Context ───────────────────────────────────────────────────────────────

interface FavouritesContextValue {
  isFavourite: (billId: string) => boolean;
  getStatus: (billId: string) => FavouriteStatus;
  toggle: (billId: string) => void;
  favouriteIds: string[];
}

const FavouritesContext = createContext<FavouritesContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FavouritesState>({ entries: {} });

  const toggle = useCallback((billId: string) => {
    setState((prev) => {
      const nowFavourite = !prev.entries[billId]?.isFavourite;
      mockServerToggle(billId, nowFavourite);
      return {
        entries: {
          ...prev.entries,
          [billId]: { isFavourite: nowFavourite, status: "idle" },
        },
      };
    });
  }, []);

  const isFavourite = useCallback(
    (billId: string) => state.entries[billId]?.isFavourite ?? false,
    [state],
  );

  const getStatus = useCallback(
    (billId: string): FavouriteStatus => state.entries[billId]?.status ?? "idle",
    [state],
  );

  const favouriteIds = useMemo(
    () => Object.entries(state.entries).filter(([, e]) => e.isFavourite).map(([id]) => id),
    [state],
  );

  return (
    <FavouritesContext.Provider value={{ isFavourite, getStatus, toggle, favouriteIds }}>
      {children}
    </FavouritesContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useFavourites() {
  const ctx = useContext(FavouritesContext);
  if (!ctx) throw new Error("useFavourites must be used within FavouritesProvider");
  return ctx;
}
