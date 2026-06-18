# Oireachtas Bills Tracker

A React + TypeScript application for browsing, filtering, and favouriting bills from the Irish legislature. Data is sourced from the public [Oireachtas API](https://api.oireachtas.ie).

## Tech stack

- **React 18** with strict mode
- **TypeScript**
- **Vite** — dev server + build, with a proxy to the Oireachtas API
- **MUI (Material UI v5)** — component library and theming
- **TanStack Query (React Query v5)** — server state, caching, pagination
- **Vitest** + **@testing-library/react** — unit and component testing
- **Biome** — linting and formatting

---

## Project structure

```
src/
├── api/
│   └── bills.ts          # fetch + mapping layer
├── components/
│   ├── favorite/
│   │   └── FavouriteButton.tsx
│   ├── layout/
│   │   └── AppLayout.tsx
│   ├── modal/
│   │   └── BillModal.tsx
│   └── BillsTable.tsx
├── context/
│   └── FavouritesContext.tsx
├── hooks/
│   └── useBills.ts
├── pages/
│   └── BillsPage.tsx
├── styles/
│   └── theme.ts
├── types.ts
├── App.tsx
└── main.tsx
```

---

## Getting started

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api` → `https://api.oireachtas.ie`, so the app makes requests to `/api/v1/legislation` which are transparently forwarded upstream. No CORS issues, no `.env` needed.

```bash
npm run build     # production build
npm run lint      # Biome lint + format check
npm test          # run all tests once
npm run test:watch
```

---

## Architecture

### API layer (`src/api/bills.ts`)

All network access goes through a single `apiFetch<T>` helper that builds the URL, appends query params (skipping empty values), and throws on non-2xx responses. The two public exports are:

**`fetchBills(params?)`** — hits `/api/v1/legislation` with optional `limit`, `skip`, and `bill_type`. Defaults to `limit: 20, skip: 0`. Returns the raw `BillsApiResponse` shape from the Oireachtas API.

**`mapBillRecord(record)`** — converts one raw `BillRecord` into a flat `Bill` domain object. Key transformations:
- `id` is the bill's full URI (unique across all bills and years)
- `billNoDisplay` is formatted as `"{billNo}/{billYear}"` or just `"{billNo}"` when the year is absent
- `sponsor` resolves the first sponsor entry: prefers `sponsor.by.showAs` (the named TD) over `sponsor.as.showAs` (the role, e.g. "Government"), falling back to `"Unknown"`
- `longTitleEn`/`longTitleGa` fall back to the short title variants when absent

### Data hooks (`src/hooks/useBills.ts`)

**`useBills({ page, pageSize, typeFilter? })`** — server-paginated query. Converts `page`/`pageSize` into `skip`/`limit` for the API. Results are cached for 5 minutes. Uses `placeholderData: (prev) => prev` so switching pages shows the previous page's data while the next page loads, eliminating layout shift.

**`useBillTypes()`** — fetches the first 1000 bills and returns the deduplicated, non-empty set of `billType` strings. Cached for 30 minutes since bill types change rarely. Returns `string[]` directly (not a query object).

### Favourites (`src/context/FavouritesContext.tsx`)

Client-side only. State is held in a `Record<billId, FavouriteEntry>` in React context, managed via `useReducer`-style `setEntries`. Exposes:

- `toggle(bill)` — adds if absent, removes if present (pure key deletion, no soft-delete)
- `isFavourite(billId)` — `billId in entries`, memoised with `useCallback`
- `favourites` — `Bill[]` derived from entries, memoised with `useMemo`
- `favouriteIds` — `string[]` of keys, memoised with `useMemo`

Favourites are not persisted to `localStorage` or any backend. They reset on page refresh. The `FavouriteEntry` type has a `status` field (`"idle" | "loading" | "success" | "error"`) that is reserved for a future persistence layer.

### BillsTable (`src/components/BillsTable.tsx`)

The main page component. Combines server-paginated "All Bills" with client-side "Favourites" in a single tabbed view. Key design decisions:

- Each tab (`all` / `favourites`) maintains its own independent `PaginationState` (page + pageSize), so switching tabs doesn't reset either tab's position.
- The "All Bills" tab is server-paginated via `useBills`. The type filter is forwarded to the API as `bill_type`.
- The "Favourites" tab pulls entirely from `FavouritesContext` and paginates/filters client-side — no network request.
- `getStatusColor` maps bill status strings to MUI chip colour tokens (`success`, `error`, `warning`, `primary`, `default`). It matches substrings deliberately (e.g. `"enact"` catches "Enacted", "Pre-enactment") to handle API value variance.
- Skeleton rows are generated with `Array.from({ length: pagination.pageSize })` so the loading state matches the expected row count exactly.
- Table rows are keyboard-accessible: `tabIndex={0}` + `onKeyDown` for `Enter`/`Space`, plus `:focus-visible` outline styling.
- The star column uses `e.stopPropagation()` on its cell click to prevent toggling a favourite from also opening the bill modal.

### BillModal (`src/components/modal/BillModal.tsx`)

Opens in a MUI `Dialog` when a table row is clicked. Closes by resetting the tab state back to English (`setTab("en")`) before calling `onClose`, so re-opening the modal always starts on the English tab. Integrates `FavouriteButton` directly, reading from and writing to `FavouritesContext`. Displays both English and Gaeilge titles via a tab switcher, with fallback copy for missing content.

### FavouriteButton (`src/components/favorite/FavouriteButton.tsx`)

A `memo`-wrapped `IconButton` that renders a filled or outlined star. Uses `aria-pressed` for toggle semantics and a dynamic `aria-label` that includes the bill number so screen reader announcements are specific ("Add 42/2024 to favourites"). Stops click propagation so it can safely sit inside a clickable table row.

### Theme (`src/styles/theme.ts`)

MUI theme with a parliamentary blue primary (`#1a4b8c`), Oireachtas green secondary (`#2e7d32`), and amber warning for the favourite star. Overrides `MuiTab`, `MuiButton`, `MuiChip`, `MuiDialog`, `MuiTableCell`, and `MuiTablePagination` to enforce consistent font weight, border radius, and text transform.

---

## Type system (`src/types.ts`)

Three layers:

**Raw API types** (`ApiSponsorEntry`, `BillRecord`, `BillsApiResponse`) — match the exact JSON shape returned by `api.oireachtas.ie/v1/legislation`. The sponsor structure is `{ sponsor: { as: {...}, by?: {...} } }` — the nested `sponsor` key is easy to miss and `by` is absent for Government bills.

**Domain model** (`Bill`) — a flat, nullable-free object produced by `mapBillRecord`. This is the type used everywhere in the UI.

**Utility types** — `InferFetchResult<T>`, `RequiredNonNullable<T>`, `ArrayElement<T>` for deriving types from function signatures and array element extraction without manual repetition.

---

## Testing

66 tests across 6 files. All tests run in a jsdom environment via Vitest.

```
src/api/api.test.ts                      16 tests
src/hooks/useBills.test.tsx              10 tests
src/context/FavouritesContext.test.tsx    7 tests
src/components/favorite/
  FavouriteButton.test.tsx                7 tests
src/components/modal/
  BillModal.test.tsx                     12 tests
src/components/
  BillsTable.test.tsx                    14 tests
```

### Setup (`src/setupTests.ts`)

Registers `@testing-library/jest-dom` matchers, runs `cleanup()` after every test, and stubs `localStorage`, `IntersectionObserver`, and `ResizeObserver` globally (the latter two are used by MUI internally).

### api.test.ts

Tests `fetchBills` by stubbing `global.fetch` with `vi.stubGlobal` per test (stubbed in `beforeEach`, restored in `afterEach` via `vi.unstubAllGlobals`). Verifies:
- Correct endpoint path and default params
- Custom `limit`/`skip` forwarding
- `bill_type` included when provided, omitted when absent
- Parsed response body returned as-is
- Non-2xx responses throw with status code in the message

Tests `mapBillRecord` as a pure function against a `buildRecord()` fixture helper. Covers:
- Basic field mapping
- `billNoDisplay` format with and without year
- `longTitle` → `shortTitle` fallback chain
- Sponsor resolution: named TD preferred, role as fallback, "Unknown" when no sponsors
- `originHouse` absent case

### useBills.test.tsx

`fetchBills` is mocked via `vi.mock` (keeping `mapBillRecord` as the real implementation via `importActual`). Each test gets a fresh `QueryClient` via a `createWrapper()` factory to prevent cache bleeding between tests. Uses `renderHook` + `waitFor` from `@testing-library/react`. Covers:
- `bills` array and `total` mapped correctly from API response
- `page`/`pageSize` → `limit`/`skip` arithmetic
- `typeFilter` forwarded as `bill_type`; empty string sends `undefined`
- Query error exposed on `result.current.error`
- Changing `page` triggers a second fetch (query key includes `page`)
- `useBillTypes` deduplicates and filters empty strings
- `useBillTypes` returns `[]` before the query resolves

### FavouritesContext.test.tsx

No mocking needed — renders `useFavourites` inside a real `FavouritesProvider` wrapper. All state mutations go through `act()`. Covers:
- Throws outside provider
- Starts empty
- `toggle` adds a bill
- `toggle` removes a bill already present
- Multiple bills tracked independently; removing one doesn't affect others
- `isFavourite` returns false for IDs never added

### FavouriteButton.test.tsx

Uses `render` + `screen` + `userEvent.setup()`. MUI icon presence checked via MUI's auto-generated `data-testid` (`StarIcon` / `StarBorderIcon`). Covers:
- Correct icon shown for each state
- `aria-label` includes bill title and correct verb ("Add" / "Remove")
- `aria-pressed` attribute reflects state
- Default `billTitle` fallback ("bill")
- `onToggle` called once on click
- Click does not propagate to a parent `onClick` handler (simulating a table row)

### BillModal.test.tsx

Wrapped in `FavouritesProvider` (real, not mocked) since `BillModal` calls `useFavourites` directly. Queries work against `document.body` since MUI `Dialog` renders into a portal. Uses a `renderModal()` helper that provides defaults and returns the `onClose` mock. Covers:
- Renders nothing when `bill` is null
- Content hidden when `open` is false
- Bill number, type, status displayed
- Sponsor shown; em dash when empty
- English long title shown by default
- Falls back to short title; then to placeholder copy
- Gaeilge tab switch shows correct title and hides English content
- Gaeilge placeholder when both Gaeilge titles absent
- Close button calls `onClose`
- Closing after switching to Gaeilge tab resets to English on next open (verified by closing then re-testing the initial render state)
- Favourite button toggles state end-to-end (aria-label flips after click)

### BillsTable.test.tsx

`useBills` and `useBillTypes` are mocked at the module level. `FavouritesProvider` is real. Each test gets a fresh `QueryClient`. A `mockUseBillsResult()` helper provides sensible defaults so individual tests only override what they need. Covers:
- Skeleton row count matches current `pageSize` (20 by default)
- Error message shown on query failure
- Empty state for all-bills tab
- Rows rendered with number, type, status, sponsor, and em dash fallback
- Clicking a row opens the modal
- `Enter` key on a focused row opens the modal
- Clicking the star inside a row does not open the modal
- Favourites tab shows count badge once a bill is starred
- Favourited bill appears on Favourites tab
- Favourites empty state when nothing starred
- Type filter dropdown shows options from `useBillTypes`
- Selecting a type filter calls `useBills` with `typeFilter` set and `page` reset to 0
- Favourites tab filters client-side: favouriting two bills of different types, then filtering by one type, hides the other

#### Known accessibility issue in BillsTable

The "Bill type" `Select`/`InputLabel` pair does not have a programmatic label association. MUI requires explicit `labelId`/`id` props to link them — without these, the `combobox` element has no accessible name and screen readers will not announce "Bill type" when the control is focused. The filter tests work around this with `getAllByRole("combobox")[0]`.

The fix is:

```tsx
<InputLabel id="bill-type-label">Bill type</InputLabel>
<Select labelId="bill-type-label" ...>
```

---

## Known limitations

- **Favourites are in-memory only.** They are lost on page refresh. The `FavouriteEntry.status` field is reserved for a future API-backed persistence layer but is not currently used.
- **`useBillTypes` fetches 1000 bills** to enumerate types client-side. A dedicated types endpoint would be preferable if the API ever exposes one.
- **No search** — `BillFilters.search` is defined in `types.ts` but not wired to the UI or the API call.
- **No sort** — `SortState` and `ColumnDef.sortKey` are defined in `types.ts` and `BillsTable` columns have no sort handler yet.
- **Oireachtas API pagination** — `billCount` in `head.counts` reflects the total matching the filters, not the full dataset. Switching the type filter resets both tab paginations to page 0.
