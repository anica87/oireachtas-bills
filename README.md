# Oireachtas Bills Viewer

A production-quality React application for browsing, filtering, and tracking Irish legislation from the [Oireachtas Open Data API](https://api.oireachtas.ie/v1).

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). No API keys required.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Architecture Deep Dive](#architecture-deep-dive)
  - [API Client & Data Mapping](#api-client--data-mapping)
  - [TypeScript Generics & infer](#typescript-generics--infer)
  - [Custom Generic DataTable](#custom-generic-datatable)
  - [FavouritesContext — useReducer + Context](#favouritescontext--usereducer--context)
  - [FavouriteButton — Stateless Presentational](#favouritebutton--stateless-presentational)
  - [TanStack Query — Server State](#tanstack-query--server-state)
  - [Filters](#filters)
  - [Accessibility](#accessibility)
  - [Responsiveness](#responsiveness)
- [API Response Shape](#api-response-shape)
- [Testing](#testing)
- [Linting & Formatting](#linting--formatting)

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| Vite | 6.x | Build tool, dev server, proxy |
| React | 19.x | UI framework |
| TypeScript | 5.x | Type safety, generics, `infer` |
| Material UI | 7.x | Component library & design system |
| TanStack Query | 5.x | Server state, caching, background refresh |
| Biome | 1.9.x | Formatting + linting (replaces ESLint + Prettier) |
| oxlint | latest | Fast secondary linter for React hooks & a11y |
| Vitest | 4.x | Unit + integration test runner |
| Testing Library | 16.x | DOM component testing |

---

## Project Structure

```
src/
├── api/
│   └── bills.ts              # API client, data mapper, mock favourite API
│                             # Defines BILL_TYPE_OPTIONS, BILL_STATUS_OPTIONS, ORIGIN_HOUSE_OPTIONS
├── components/
│   ├── favorite/
│   │   └── FavouriteButton.tsx  # Stateless/presentational — all state via props
│   ├── layout/
│   │   └── AppLayout.tsx     # Skip link, header, footer, landmark regions
│   ├── modal/
│   │   └── BillModal.tsx     # Accessible dialog with tabbed En/Ga content
│   └── table/
│       ├── DataTable.tsx     # Generic, reusable table engine (custom, no TanStack Table)
│       └── BillsTable.tsx    # Domain-specific: bill columns + multi-filter controls
├── context/
│   └── FavouritesContext.tsx # useReducer + Context, localStorage, optimistic updates
├── hooks/
│   └── useBills.ts           # useGenericFetch<T> + useBills wrapping TanStack Query
├── pages/
│   └── BillsPage.tsx         # Main view: All Bills / Favourites tabs
├── styles/
│   └── theme.ts              # Custom MUI theme (parliamentary blue + Oireachtas green)
├── test/
│   ├── setup.ts              # Vitest global setup: jest-dom + ResizeObserver mock
│   └── utils.tsx             # renderWithProviders — wraps all providers for tests
└── types/
    └── index.ts              # Domain types, utility types (InferFetchResult, etc.)
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9

### Install dependencies

```bash
npm install
```

### Development server

```bash
npm run dev
```

Vite proxies `/api` → `https://api.oireachtas.ie` in development (configured in `vite.config.ts`), so there are no CORS issues.

### Production build

```bash
npm run build
npm run preview
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR at localhost:5173 |
| `npm run build` | Type-check + build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run Biome check + oxlint across `src/` |
| `npm run lint:biome` | Biome only |
| `npm run lint:oxlint` | oxlint only |
| `npm run lint:fix` | Auto-fix Biome formatting + safe lint fixes |
| `npm run format` | Format all files with Biome |
| `npm run test` | Run all tests once |
| `npm run test:watch` | Vitest in interactive watch mode |
| `npm run test:coverage` | Tests with HTML coverage report |
| `npm run type-check` | TypeScript type check only (no emit) |

---

## Architecture Deep Dive

### API Client & Data Mapping

**File:** `src/api/bills.ts`

The Oireachtas API at `https://api.oireachtas.ie/v1/legislation` returns a deeply nested JSON structure. A crucial detail is how sponsors are structured:

```json
{
  "bill": {
    "billNo": "42",
    "billYear": "2024",
    "billType": "Public",
    "status": "First Stage",
    "shortTitleEn": "Finance Act 2024",
    "shortTitleGa": "Acht Airgeadais 2024",
    "originHouse": { "showAs": "Dáil", "uri": "..." },
    "sponsors": [
      {
        "sponsor": {
          "as": { "showAs": "Government", "uri": "..." },
          "by": { "showAs": "Micheál Martin", "uri": "..." }
        }
      }
    ],
    "uri": "http://data.oireachtas.ie/ie/oireachtas/bill/2024/42"
  }
}
```

Key points:
- Each sponsor entry wraps in `{ sponsor: { as, by? } }` — note the nested `sponsor` key
- `as` = the role/capacity (e.g. "Government")
- `by` = the individual person (absent for government bills, present for Private Members' Bills)
- We prefer `by.showAs` (the person's name) and fall back to `as.showAs` (the role)

The `mapBillRecord()` function transforms this into a flat `Bill` domain model:

```ts
function extractSponsorName(sponsors: ApiSponsorEntry[]): string {
  if (!sponsors || sponsors.length === 0) return "Unknown";
  const first = sponsors[0].sponsor;
  return first.by?.showAs ?? first.as?.showAs ?? "Unknown";
}
```

**API filter parameters** (not the display labels):

| UI Label | API param | Values |
|---|---|---|
| Bill Type | `bill_type` | `pub`, `pri`, `pmb` |
| Status | `bill_status` | `Current`, `Enacted`, `Lapsed`, `Withdrawn`, `Defeated` |
| House | `chamber_id` | `dail`, `seanad` |

---

### TypeScript Generics & `infer`

**File:** `src/types/index.ts`

The `InferFetchResult<T>` utility type uses TypeScript's `infer` keyword to extract the resolved return type of any async function. This means derived types stay in sync with API functions automatically:

```ts
export type InferFetchResult<T extends (...args: never[]) => Promise<unknown>> =
  T extends (...args: never[]) => Promise<infer R> ? R : never;

// BillsData is always the resolved type of fetchBills — no manual annotation
export type BillsData = InferFetchResult<typeof fetchBills>;
// → BillsApiResponse
```

Other generic utility types:

```ts
// All properties required and non-nullable
type RequiredNonNullable<T> = { [K in keyof T]-?: NonNullable<T[K]> };

// Extract element type from an array
type ArrayElement<T extends readonly unknown[]> =
  T extends ReadonlyArray<infer E> ? E : never;
```

The `ColumnDef<TData>` type is also generic — `DataTable<Bill>` uses `ColumnDef<Bill>[]`, while `DataTable<Member>` would use `ColumnDef<Member>[]`:

```ts
export interface ColumnDef<TData> {
  key: string;
  header: string;
  sortKey?: string | false;
  cell: (row: TData) => React.ReactNode;
  minWidth?: string;
  width?: string;
}
```

The `useGenericFetch<T>` hook demonstrates the same pattern:

```ts
export function useGenericFetch<T>(
  options: UseQueryOptions<T>,
): UseQueryResult<T> {
  return useQuery<T>(options);
}

// Callers get full type inference without annotating
const result = useGenericFetch<PaginatedResult<Bill>>({
  queryKey: ["bills"],
  queryFn: async () => { ... },
});
// result.data is PaginatedResult<Bill> | undefined
```

---

### Custom Generic DataTable

**File:** `src/components/table/DataTable.tsx`

Built entirely from scratch without TanStack Table. Separates table mechanics from domain logic.

**Core concept:** column definitions are pure configuration objects. The table renders them — it has no knowledge of bills, members, or any other domain.

```ts
interface ColumnDef<TData> {
  key: string;           // unique column identifier
  header: string;        // displayed header text
  sortKey?: string | false;  // false = not sortable
  cell: (row: TData) => React.ReactNode;  // render function
  minWidth?: string;
  width?: string;
}
```

**Usage:**

```tsx
const columns: ColumnDef<Bill>[] = [
  {
    key: "billNoDisplay",
    header: "Bill No.",
    sortKey: "billNo",
    cell: (bill) => <strong>{bill.billNoDisplay}</strong>,
  },
  {
    key: "favourite",
    header: "",
    sortKey: false,    // not sortable
    cell: (bill) => <FavouriteButton ... />,
  },
];

<DataTable<Bill>
  columns={columns}
  data={bills}
  rowCount={total}
  pagination={pagination}
  onPaginationChange={setPagination}
  getRowKey={(bill) => bill.id}
  onRowClick={(bill) => openModal(bill)}
/>
```

**Features built into the table:**
- Server-side pagination with MUI `TablePagination`
- Controlled sort state — column headers show sort indicators
- Skeleton rows during loading (using MUI `Skeleton`)
- Error state with `role="alert"`
- Empty state slot (customisable)
- Background-refresh indicator (spinner + "Refreshing…" text)
- Keyboard-navigable rows (`role="button"`, `tabIndex={0}`, `Enter`/`Space` handlers)
- Full ARIA semantics (`aria-label`, `aria-busy`, `aria-rowcount`, `aria-sort`)
- `React.memo` on `SkeletonRows` to avoid unnecessary re-renders

**Reusability:** This component can be dropped into any project that needs a sortable, paginated, accessible data table. Pass in different `ColumnDef<T>` arrays to render any domain object.

---

### FavouritesContext — useReducer + Context

**File:** `src/context/FavouritesContext.tsx`

Global favourites state is managed with `useReducer` for explicit, traceable transitions and `Context` for subscription without prop drilling.

**State shape:**

```ts
interface FavouritesState {
  entries: Record<string, FavouriteEntry>;      // billId → entry
  previousValues: Record<string, boolean>;       // billId → pre-toggle value (for revert)
}

interface FavouriteEntry {
  billId: string;
  isFavourite: boolean;
  status: FavouriteStatus;  // "idle" | "loading" | "success" | "error"
}
```

**Actions:**

| Action | When | Effect |
|---|---|---|
| `HYDRATE` | On mount | Loads saved IDs from localStorage |
| `OPTIMISTIC_TOGGLE` | User clicks star | Immediately flips `isFavourite`, sets status `"loading"`, saves previous value |
| `TOGGLE_SUCCESS` | Server responds OK | Sets status `"success"`, clears previous value |
| `TOGGLE_ERROR` | Server fails | Reverts `isFavourite` to saved previous value, sets status `"error"` |

**Optimistic update flow:**

```
User clicks ★
    → dispatch OPTIMISTIC_TOGGLE
    → UI shows new state immediately (loading spinner)
    → call toggleFavouriteBillApi(billId, nextValue)
        → success: dispatch TOGGLE_SUCCESS
        → error:   dispatch TOGGLE_ERROR → revert to previousValue
```

**localStorage:**
- Hydrated once on mount via `useEffect`
- Persisted on every change to `favouriteIds` via a separate `useEffect`
- The `STORAGE_KEY` constant (`"oireachtas_favourites"`) is exported for tests
- Handles corrupt JSON gracefully (returns `[]`)

---

### FavouriteButton — Stateless Presentational

**File:** `src/components/favorite/FavouriteButton.tsx`

A pure presentational component — all state is passed via props. This makes it:

- **Testable in isolation** — no context dependencies in the component itself
- **Reusable** — works with any server state library
- **Predictable** — given the same props, renders the same output

```tsx
<FavouriteButton
  isFavourite={isFavourite(bill.id)}
  status={getStatus(bill.id)}
  onToggle={() => void toggle(bill.id)}
  itemLabel={`Bill ${bill.billNoDisplay}`}
  size="small"
/>
```

**States rendered:**

| `isFavourite` | `status` | Rendered |
|---|---|---|
| false | idle | Empty star icon |
| true | idle | Filled amber star |
| any | loading | Circular progress spinner |
| any | error | Error icon (click to retry) |

**Accessibility:**
- `aria-pressed` reflects current favourite state
- `aria-label` describes the action ("Add Bill 42/2024 to favourites")
- `e.stopPropagation()` on click/keydown prevents table row click from firing simultaneously
- `Tooltip` provides visual hover label for sighted users

---

### TanStack Query — Server State

**File:** `src/hooks/useBills.ts`

TanStack Query handles all server state concerns:

- **Caching**: repeated requests for the same filters/page return instantly from cache
- **Background refresh**: stale data is automatically refetched without blocking UI
- **Placeholder data**: previous page's data is shown while the next page loads (no blank flash)
- **Retry**: failed requests automatically retry twice before surfacing an error

```ts
export function useBills({ pagination, filters }: UseBillsOptions) {
  return useGenericFetch<PaginatedResult<Bill>>({
    queryKey: ["bills", apiParams],  // cache key — changes trigger refetch
    queryFn: async () => { ... },
    placeholderData: (prev) => prev,  // show previous data while loading
    staleTime: 1000 * 60 * 5,         // 5 minutes before background refetch
  });
}
```

The query key includes all filter parameters, so changing any filter triggers a fresh fetch automatically.

---

### Filters

**File:** `src/components/table/BillsTable.tsx`

Four filters are available on the "All Bills" tab:

| Filter | Implementation | Notes |
|---|---|---|
| **Search** | Client-side, on title/sponsor/bill no | The API has no free-text search endpoint |
| **Bill Type** | Server-side via `bill_type` param | `pub` / `pri` / `pmb` |
| **Status** | Server-side via `bill_status` param | `Current`, `Enacted`, `Lapsed`, etc. |
| **House** | Server-side via `chamber_id` param | `dail` / `seanad` |

All active filters are displayed as removable chips below the filter row. A "Clear all" chip removes all filters at once. Every filter change resets the page index to 0 to avoid showing an empty page.

---

### Accessibility

Accessibility is a first-class concern throughout the application:

**App-level:**
- Skip-to-main-content link (visible on focus at top of page)
- ARIA landmark regions: `role="banner"` (header), `role="main"` (content), `role="contentinfo"` (footer)
- Page `<title>` describes the content
- Google Fonts `preconnect` and `display=swap` for font performance

**Table:**
- `<table aria-label="Bills list" aria-busy={isLoading} aria-rowcount={total}>`
- `<th scope="col">` with `aria-sort` attributes for sorted columns
- Clickable rows: `role="button"`, `tabIndex={0}`, `onKeyDown` for `Enter`/`Space`
- `role="alert"` on error cell for screen reader announcement
- Skeleton rows: `aria-hidden="true"` so screen readers skip them
- Background refresh: `role="status" aria-live="polite"` for non-disruptive announcement

**Modal:**
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to `<DialogTitle>`
- Focus management handled by MUI Dialog
- Close button: explicit `aria-label="Close bill details"`
- Tabs: `id`, `aria-controls`, `aria-selected`, `aria-labelledby` on panels

**Filters:**
- Each `<Select>` has a `<InputLabel>` linked via `labelId`/`id`
- Chip delete buttons have descriptive `aria-label` ("Remove filter: Public")
- Search field: `inputProps={{ "aria-label": "Search bills" }}`

**FavouriteButton:**
- `aria-pressed` (boolean) indicates toggle state to screen readers
- `aria-label` dynamically describes the action ("Add Bill 42/2024 to favourites")
- Loading state: button is `disabled`; loading progress has `aria-hidden="true"`

---

### Responsiveness

The application is responsive across all viewports:

- **Filter row:** wraps from horizontal `row` to vertical `column` on `xs` screens
- **Table:** `overflowX: "auto"` ensures horizontal scroll on small screens without breaking layout
- **Modal:** `fullWidth maxWidth="sm"` — takes available width on mobile
- **Typography in header:** supplementary tagline hidden on `xs` via `display: { xs: "none", sm: "block" }`
- **TablePagination:** toolbar wraps on narrow viewports

---

## API Response Shape

The full response from `GET /v1/legislation?limit=20&skip=0`:

```json
{
  "head": {
    "counts": {
      "billCount": 4823
    }
  },
  "results": [
    {
      "bill": {
        "billNo": "42",
        "billYear": "2024",
        "billType": "Public",
        "status": "First Stage",
        "shortTitleEn": "Finance Act 2024",
        "shortTitleGa": "Acht Airgeadais 2024",
        "longTitleEn": "An Act to provide for...",
        "longTitleGa": "Acht chun...",
        "originHouse": {
          "showAs": "Dáil",
          "uri": "http://data.oireachtas.ie/ie/oireachtas/house/dail/33"
        },
        "sponsors": [
          {
            "sponsor": {
              "as": {
                "showAs": "Government",
                "uri": "http://data.oireachtas.ie/..."
              },
              "by": {
                "showAs": "Micheál Martin",
                "uri": "http://data.oireachtas.ie/...",
                "memberCode": "MartM"
              }
            }
          }
        ],
        "uri": "http://data.oireachtas.ie/ie/oireachtas/bill/2024/42"
      }
    }
  ]
}
```

**Sponsor extraction logic:**

The `sponsor.as` field holds the *role* (e.g. "Government") and `sponsor.by` holds the *person* (e.g. "Micheál Martin"). For government bills, `by` is present with the minister's name. For Private Members' Bills, `by` holds the TD's name. For bills where no individual is identified, only `as` is present.

Our `extractSponsorName` function applies this priority:

```
by.showAs → as.showAs → "Unknown"
```

This means government bills show "Micheál Martin" (not "Government"), and private bills where the TD is identified show the TD's name.

---

## Testing

```bash
npm run test            # run all tests once
npm run test:watch      # interactive watch mode
npm run test:coverage   # with coverage HTML report
```

### Test files

| File | Tests | What is covered |
|---|---|---|
| `bills.test.ts` | 12 | `mapBillRecord` — all fields, sponsor extraction logic, fallbacks |
| `FavouriteButton.test.tsx` | 9 | ARIA states, click, keyboard, disabled, error, propagation |
| `FavouritesContext.test.tsx` | 9 | Optimistic toggle, server confirm/revert, localStorage persist/hydrate/unfavourite |
| `DataTable.test.tsx` | 10 | Headers, rows, skeleton, empty, error, click, keyboard, pagination, aria-label |
| `BillModal.test.tsx` | 9 | Tab switching, close, favourite button, sponsor, house, null/closed states |

### localStorage tests (in `FavouritesContext.test.tsx`)

The three tests that previously failed are now robust:

**"persists favourites to localStorage after server confirms"**
Uses `waitFor` to poll localStorage after the mock API resolves, ensuring the `useEffect` that persists favouriteIds has run.

**"can unfavourite a bill and removes it from localStorage"**
Pre-seeds localStorage with `["bill-1"]`, waits for hydration, then toggles off. Waits for the bill ID to be absent from localStorage.

**"hydrates from localStorage on mount"**
Pre-seeds localStorage with two IDs. Waits for the hydration `useEffect` to fire and for the component to reflect the loaded state.

**"handles corrupt localStorage gracefully"**
Sets an invalid JSON string. Verifies the component starts with empty state without throwing.

**"does not write to localStorage if server errors"**
Mocks the API to reject. After the revert, verifies the bill is not in localStorage.

### Test infrastructure

- `src/test/setup.ts` — imports `@testing-library/jest-dom`, cleans up after each test, mocks `ResizeObserver` and `IntersectionObserver` as proper class constructors (required for MUI Tabs)
- `src/test/utils.tsx` — `renderWithProviders` wraps components with `QueryClientProvider`, `ThemeProvider`, and `FavouritesProvider`
- `vitest.config.ts` — inlines MUI packages to resolve ESM/CJS conflicts in the test environment

---

## Linting & Formatting

Two complementary tools run in parallel:

### Biome (`biome.json`)

Handles formatting and most lint rules. Key configuration:

```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  }
}
```

```bash
npm run lint:biome    # check
npm run lint:fix      # auto-fix
```

### oxlint (`.oxlintrc.json`)

Catches React hooks violations, exhaustive-deps warnings, and additional a11y rules that complement Biome.

```bash
npm run lint:oxlint
```

Both tools run together:

```bash
npm run lint
```
