import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";
import { favouriteBillRequest, unfavouriteBillRequest } from "@/api/favourites";
import type { Bill } from "@/types";

const FAVOURITES_QUERY_KEY = ["favourites"] as const;

type FavouritesMap = Record<string, Bill>;

interface ToggleVariables {
  bill: Bill;
  wasFavourite: boolean;
}

interface FavouritesContextValue {
  isFavourite: (billId: string) => boolean;
  toggle: (bill: Bill) => void;
  favourites: Bill[];
  favouriteIds: string[];
}

const FavouritesContext = createContext<FavouritesContextValue | null>(null);

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Favourites live in the React Query cache rather than useState. There's
  // no queryFn — nothing is ever fetched from a server for this key — it's
  // used purely as shared, reactive client state so the mutation below can
  // read/write it through the same cache mechanism as everything else in
  // the app, and any component can subscribe to it via useQuery without
  // prop-drilling through context if that's ever useful later.
  const { data: favouritesMap = {} } = useQuery<FavouritesMap>({
    queryKey: FAVOURITES_QUERY_KEY,
    queryFn: () => ({}),
    staleTime: Infinity,
    initialData: {},
  });

  const toggleMutation = useMutation({
    // `wasFavourite` is captured once, in toggle(), at the moment of the
    // click — BEFORE onMutate has a chance to flip the cache. Both
    // onMutate and mutationFn branch on this same pre-click snapshot
    // rather than each independently re-reading the cache, which would
    // race: onMutate runs first and mutates the cache, so if mutationFn
    // re-derived "is this currently favourited" from the cache afterward,
    // it would see the POST-optimistic-update state and dispatch the
    // wrong request (e.g. logging "un-favourite" on a bill that was just
    // favourited for the first time).
    mutationFn: async ({ bill, wasFavourite }: ToggleVariables) => {
      if (wasFavourite) {
        await unfavouriteBillRequest(bill.id);
      } else {
        await favouriteBillRequest(bill.id);
      }

      return { bill, wasFavourite };
    },

    // Optimistic update: flip the favourite state in the cache immediately,
    // before the mocked request resolves, so the UI changes on click as
    // required. Snapshot the previous value so onError can roll back.
    onMutate: async ({ bill, wasFavourite }: ToggleVariables) => {
      await queryClient.cancelQueries({ queryKey: FAVOURITES_QUERY_KEY });

      const previous = queryClient.getQueryData<FavouritesMap>(FAVOURITES_QUERY_KEY) ?? {};

      queryClient.setQueryData<FavouritesMap>(FAVOURITES_QUERY_KEY, (prev = {}) => {
        if (wasFavourite) {
          const { [bill.id]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [bill.id]: bill };
      });

      return { previous };
    },

    // Roll back to the pre-mutation snapshot if the mocked request rejects.
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(FAVOURITES_QUERY_KEY, context.previous);
      }
    },

    // No-op on success: the optimistic update already reflects the final
    // state, and there's no server response payload to reconcile against
    // since this is a mocked, fire-and-forget-style confirmation.
  });

  const toggle = useCallback(
    (bill: Bill) => {
      // Read current favourite state exactly once, synchronously, at the
      // moment of the click — this is the single source of truth for
      // "was this favourited before the user clicked," passed through to
      // both onMutate and mutationFn so they never disagree with each other.
      const current = queryClient.getQueryData<FavouritesMap>(FAVOURITES_QUERY_KEY) ?? {};
      const wasFavourite = bill.id in current;

      toggleMutation.mutate({ bill, wasFavourite });
    },
    [toggleMutation, queryClient],
  );

  const isFavourite = useCallback((billId: string) => billId in favouritesMap, [favouritesMap]);

  const favourites = useMemo(() => Object.values(favouritesMap), [favouritesMap]);

  const favouriteIds = useMemo(() => Object.keys(favouritesMap), [favouritesMap]);

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
