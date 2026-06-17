/**
 * FavouritesContext — global state for favourited bills.
 *
 * Architecture:
 *   useReducer — explicit, traceable state transitions
 *   Context    — subscription without prop drilling
 *   localStorage — persistence across sessions
 *
 * Features:
 *   - Optimistic updates (UI changes immediately)
 *   - Server sync with revert on failure
 *   - localStorage hydration on mount
 *   - Persistence on every change
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { toggleFavouriteBillApi } from "@/api/bills";
import type { FavouriteEntry, FavouriteStatus } from "@/types";

// ─── State ─────────────────────────────────────────────────────────────────

export interface FavouritesState {
  /** Map of billId → FavouriteEntry */
  entries: Record<string, FavouriteEntry>;
  /** Previous value per bill for revert on error */
  previousValues: Record<string, boolean>;
}

const initialState: FavouritesState = {
  entries: {},
  previousValues: {},
};

// ─── Actions ───────────────────────────────────────────────────────────────

type FavouritesAction =
  | { type: "HYDRATE"; favouriteIds: string[] }
  | { type: "OPTIMISTIC_TOGGLE"; billId: string; nextValue: boolean; previousValue: boolean }
  | { type: "TOGGLE_SUCCESS"; billId: string; confirmedValue: boolean }
  | { type: "TOGGLE_ERROR"; billId: string }
  | { type: "SET_STATUS"; billId: string; status: FavouriteStatus };

// ─── Reducer ───────────────────────────────────────────────────────────────

function favouritesReducer(state: FavouritesState, action: FavouritesAction): FavouritesState {
  switch (action.type) {
    case "HYDRATE": {
      const entries: Record<string, FavouriteEntry> = {};
      for (const id of action.favouriteIds) {
        entries[id] = { billId: id, isFavourite: true, status: "idle" };
      }
      return { ...state, entries };
    }

    case "OPTIMISTIC_TOGGLE": {
      return {
        ...state,
        entries: {
          ...state.entries,
          [action.billId]: {
            billId: action.billId,
            isFavourite: action.nextValue,
            status: "loading",
          },
        },
        previousValues: {
          ...state.previousValues,
          [action.billId]: action.previousValue,
        },
      };
    }

    case "TOGGLE_SUCCESS": {
      // Clean up the stored previous value
      const { [action.billId]: _removed, ...remainingPrev } = state.previousValues;
      void _removed;
      return {
        ...state,
        entries: {
          ...state.entries,
          [action.billId]: {
            billId: action.billId,
            isFavourite: action.confirmedValue,
            status: "success",
          },
        },
        previousValues: remainingPrev,
      };
    }

    case "TOGGLE_ERROR": {
      const revertTo = state.previousValues[action.billId] ?? false;
      const { [action.billId]: _removed, ...remainingPrev } = state.previousValues;
      void _removed;
      return {
        ...state,
        entries: {
          ...state.entries,
          [action.billId]: {
            billId: action.billId,
            isFavourite: revertTo,
            status: "error",
          },
        },
        previousValues: remainingPrev,
      };
    }

    case "SET_STATUS": {
      const existing = state.entries[action.billId];
      return {
        ...state,
        entries: {
          ...state.entries,
          [action.billId]: {
            ...(existing ?? { billId: action.billId, isFavourite: false }),
            status: action.status,
          },
        },
      };
    }

    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────

interface FavouritesContextValue {
  state: FavouritesState;
  isFavourite: (billId: string) => boolean;
  getStatus: (billId: string) => FavouriteStatus;
  toggle: (billId: string) => Promise<void>;
  favouriteIds: string[];
}

const FavouritesContext = createContext<FavouritesContextValue | null>(null);

// ─── localStorage helpers ─────────────────────────────────────────────────

export const STORAGE_KEY = "oireachtas_favourites";

function loadFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
    return [];
  } catch {
    return [];
  }
}

function saveToStorage(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Silently ignore storage quota errors
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(favouritesReducer, initialState);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const ids = loadFromStorage();
    if (ids.length > 0) {
      dispatch({ type: "HYDRATE", favouriteIds: ids });
    }
  }, []);

  // Derive the list of currently-favourited bill IDs
  const favouriteIds = useMemo(
    () =>
      Object.values(state.entries)
        .filter((e) => e.isFavourite)
        .map((e) => e.billId),
    [state.entries],
  );

  // Persist whenever the set of favourited IDs changes
  useEffect(() => {
    saveToStorage(favouriteIds);
  }, [favouriteIds]);

  const isFavourite = useCallback(
    (billId: string) => state.entries[billId]?.isFavourite ?? false,
    [state.entries],
  );

  const getStatus = useCallback(
    (billId: string): FavouriteStatus => state.entries[billId]?.status ?? "idle",
    [state.entries],
  );

  const toggle = useCallback(
    async (billId: string) => {
      const previousValue = state.entries[billId]?.isFavourite ?? false;
      const nextValue = !previousValue;

      // Optimistic update — UI reflects new state immediately
      dispatch({
        type: "OPTIMISTIC_TOGGLE",
        billId,
        nextValue,
        previousValue,
      });

      try {
        await toggleFavouriteBillApi(billId, nextValue);
        dispatch({ type: "TOGGLE_SUCCESS", billId, confirmedValue: nextValue });
      } catch (err) {
        console.error("[Favourites] Server sync failed, reverting:", err);
        dispatch({ type: "TOGGLE_ERROR", billId });
      }
    },
    [state.entries],
  );

  const value = useMemo(
    () => ({ state, isFavourite, getStatus, toggle, favouriteIds }),
    [state, isFavourite, getStatus, toggle, favouriteIds],
  );

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useFavourites(): FavouritesContextValue {
  const ctx = useContext(FavouritesContext);
  if (!ctx) {
    throw new Error("useFavourites must be used within FavouritesProvider");
  }
  return ctx;
}
