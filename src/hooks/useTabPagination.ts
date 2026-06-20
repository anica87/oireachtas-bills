import { useCallback, useState } from "react";

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface PaginationState {
  page: number;
  pageSize: PageSize;
}

const DEFAULT_PAGINATION: PaginationState = { page: 0, pageSize: 20 };

/**
 * Keeps a separate page/pageSize per tab so switching tabs never resets the
 * other tab's position. Exposes the active tab's pagination plus a setter
 * that always writes to whichever tab is currently active, and a helper to
 * reset both tabs to page 0 (used when a cross-tab filter changes).
 */
export function useTabPagination<TTab extends string>(tab: TTab) {
  const [paginationByTab, setPaginationByTab] = useState<Record<TTab, PaginationState>>(
    () => ({ [tab]: DEFAULT_PAGINATION }) as Record<TTab, PaginationState>,
  );

  const pagination = paginationByTab[tab] ?? DEFAULT_PAGINATION;

  const setPagination = useCallback(
    (update: PaginationState | ((prev: PaginationState) => PaginationState)) => {
      setPaginationByTab((prev) => {
        const current = prev[tab] ?? DEFAULT_PAGINATION;
        const next = typeof update === "function" ? update(current) : update;
        return { ...prev, [tab]: next };
      });
    },
    [tab],
  );

  const resetAllTabsToFirstPage = useCallback(() => {
    setPaginationByTab(
      (prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, value]) => [
            key,
            { ...(value as PaginationState), page: 0 },
          ]),
        ) as Record<TTab, PaginationState>,
    );
  }, []);

  return { pagination, setPagination, resetAllTabsToFirstPage };
}
