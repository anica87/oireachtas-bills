# Oireachtas Bills Explorer

[![CI](https://github.com/anica87/oireachtas-bills/actions/workflows/ci.yml/badge.svg)](https://github.com/anica87/oireachtas-bills/actions/workflows/ci.yml)

A React + TypeScript app for browsing Irish legislative bills, with type filtering, pagination, and the ability to favourite bills for quick reference.

## Features

- **Browse bills** — paginated table of all bills, backed by the live Oireachtas API
- **Filter by bill type** — client-side filtering across the full dataset (see [Filtering](#filtering-by-bill-type) below for why)
- **Favourite bills** — star any bill to save it; favourites persist across tabs and sync to a (mocked) server
- **Two tabs** — "All Bills" (server-paginated) and "Favourites" (client-side, in-memory), each with independent pagination state
- **Bilingual bill detail** — view each bill's title in English or Gaeilge

## Tech stack

- React + TypeScript
- [TanStack Query](https://tanstack.com/query) (`@tanstack/react-query`) for all server-state — data fetching, caching, and now mutations
- MUI (Material UI) for components
- Vitest + React Testing Library for tests

## Getting started

Requires Node 22+ (matches the version pinned in CI).

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build         # type-check (tsc -b) + production build
npm run test           # run the test suite once
npm run test:watch     # run tests in watch mode
npm run test:coverage  # run tests with coverage report
npm run lint            # Biome + oxlint, no fixes applied
npm run lint:fix        # Biome, applying safe fixes
npm run format           # Biome, format-only
npm run type-check       # tsc -b across all project references
```

CI (`.github/workflows/ci.yml`) runs `lint`, `type-check`, `test`, and `build` on every push and pull request against `main`.

## Architecture overview

### Data fetching

| Hook | Purpose |
|---|---|
| `useBills` | Returns the current page of bills — either backend-paginated (no filter active) or client-side filtered/paginated (filter active) |
| `useAllBills` | Fetches the *entire* dataset in parallel batches, used only when filtering requires it |
| `useBillTypes` | Derives the list of distinct bill types from the full dataset, for the filter dropdown |

### Filtering by bill type

The backend's `/legislation` endpoint **silently ignores the `bill_type` query parameter** — passing it has no effect on the results. Filtering by type therefore has to happen client-side, which in turn means the full dataset needs to be available locally before a filter can be applied.

The backend also caps `limit` at 1,000 records per request, so `useAllBills` fetches the ~6,000+ bills in batches: one initial request reveals the total count, then all remaining batches are fetched **in parallel** (`Promise.all`) rather than sequentially, cutting wall-clock load time roughly in proportion to the number of batches.

#### Lazy loading (`touchedBillType` / `filterTouched`)

Fetching the entire dataset is not free — it's several network requests, even parallelized. Since most visits to the "All Bills" tab never touch the type filter, the app defers this fetch until the user actually shows intent to filter:

- `filterTouched` becomes `true` the moment the bill-type dropdown is **opened** (not when a value is selected) — this is what's referred to elsewhere as "touchedBillType": has the user touched/interacted with the bill-type filter at all.
- Until then, `useAllBills` stays disabled (`enabled: false` in React Query terms), and the "All Bills" tab uses cheap, backend-paginated requests (`limit`/`skip`) exclusively.
- Once `filterTouched` is `true`, the full dataset loads once, gets cached (`staleTime: 10 minutes`), and both the filter dropdown's options and any subsequent filtering operate on it — no second fetch needed for the rest of the session.

This means: browsing without ever opening the filter costs nothing extra; opening the filter costs one batch-fetch, paid once.

### Favourites

Clicking the star icon on any bill row (or in the bill detail modal) favourites it; clicking again un-favourites it. This is a genuinely new feature in this version of the app — previously favourites only existed as static UI with no persistence or server interaction.

**How it works:**

- Favourite state lives in the **TanStack Query cache** (under the `["favourites"]` key) rather than local component state, so it's available anywhere in the app without prop-drilling.
- Toggling a favourite is a `useMutation`, with React Query's standard optimistic-update pattern:
  1. **`onMutate`** flips the UI immediately — the star fills in or empties out the instant you click, before any network round trip completes.
  2. **`mutationFn`** dispatches a (mocked) request to the server — `favouriteBillRequest(billId)` or `unfavouriteBillRequest(billId)`, each of which logs to the console when the request is dispatched and again when the server confirms it.
  3. **`onError`** rolls the optimistic change back if the request fails, so the UI never drifts out of sync with what the server actually has.
- **Which request fires (favourite vs. un-favourite)** is decided once, synchronously, at the moment of the click — *before* any optimistic update touches the cache. This avoids a subtle race condition where deciding "is this currently favourited?" by re-reading the cache *after* the optimistic update would always see the post-click state and dispatch the wrong request.

**Mocked server layer:** `src/api/favourites.ts` simulates the network call (artificial latency + console logging, no real backend). Swapping in a real API later only requires changing this one file — every other piece (the mutation, the optimistic update, the UI) is already written against a `(billId: string) => Promise<void>` contract that a real implementation would also satisfy.

**Known limitation:** favourites are in-memory only and are lost on a full page refresh. There is no `localStorage` or backend persistence layer in this version.

## Project structure

```
src/
  api/
    bills.ts             # fetchBills, mapBillRecord
    favourites.ts         # mocked favourite/un-favourite requests
  hooks/
    useBills.ts
    useAllBills.ts
    useBillTypes.ts
    useTabPagination.ts   # per-tab page/pageSize state
  context/
    FavouritesContext.tsx
  components/
    layout/
      AppLayout.tsx       # app bar + page shell
    table/
      BillsTable.tsx       # self-contained: owns tabs, filter, pagination, and the row-click modal
    modal/
      BillModal.tsx
    favorite/
      FavouriteButton.tsx
  pages/
    BillsPage.tsx          # thin page wrapper around BillsTable
  test/
    setup.ts                # jest-dom matchers + jsdom polyfills (ResizeObserver etc.)
```

## Testing

Each hook and component has a corresponding `*.test.ts`/`*.test.tsx` file covering:

- Data mapping and pagination math
- Lazy-loading gating (`useAllBills`/`useBillTypes` only fetch when enabled)
- Client-side filter correctness
- Favourite/un-favourite optimistic updates, rollback on failure, and — specifically — that the correct request (favourite vs. un-favourite) is dispatched on a bill's very first toggle

Run a single test file:

```bash
npx vitest run src/context/FavouritesContext.test.tsx
```

## Known trade-offs

- **Client-side filtering caps out eventually.** This approach works well at the current scale (~6,000 bills) but would need a real backend filter (or a different pagination strategy) at significantly larger volumes.
- **No per-bill mutation status surfaced in the UI.** The favourites mutation doesn't currently expose granular "this specific bill is mid-sync" state to the UI — only the most recent mutation's status is easily accessible via `useMutation`. Worth revisiting if a loading indicator per-favourite becomes a requirement.
- **Favourites don't persist across refreshes** (see above).

## Notes on the TypeScript setup

`tsconfig.json` is a references-only shell (`"files": []`) pointing at `tsconfig.app.json` (app source) and `tsconfig.node.json` (Vite/Vitest config files) — the standard structure Vite's own React+TS template scaffolds, kept here so editor tooling and `tsc -b` agree on project boundaries. `npm run build` and `npm run type-check` both use `tsc -b` (build mode) rather than plain `tsc`, since plain `tsc` against a references-only root does nothing useful.