import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { Bill } from "@/types";

interface FavouriteEntry {
  bill: Bill;
  status: "idle" | "loading" | "success" | "error";
}

interface FavouritesContextValue {
  isFavourite: (billId: string) => boolean;
  toggle: (bill: Bill) => void;
  favourites: Bill[];
  favouriteIds: string[];
}

const FavouritesContext = createContext<FavouritesContextValue | null>(null);

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, FavouriteEntry>>({});

  const toggle = useCallback((bill: Bill) => {
    setEntries((prev) => {
      if (prev[bill.id]) {
        const { [bill.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [bill.id]: { bill, status: "idle" } };
    });
  }, []);

  const isFavourite = useCallback((billId: string) => billId in entries, [entries]);

  const favourites = useMemo(() => Object.values(entries).map((e) => e.bill), [entries]);

  const favouriteIds = useMemo(() => Object.keys(entries), [entries]);

  return (
    <FavouritesContext.Provider value={{ isFavourite, toggle, favourites, favouriteIds }}>
      {children}
    </FavouritesContext.Provider>
  );
}

export function useFavourites() {
  const ctx = useContext(FavouritesContext);
  if (!ctx) throw new Error("useFavourites must be used within FavouritesProvider");
  return ctx;
}
