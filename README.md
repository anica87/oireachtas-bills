# Oireachtas Bills Tracker

A React + TypeScript app for browsing, filtering, and favouriting bills from the Irish legislature, using the public [Oireachtas API](https://api.oireachtas.ie).

## Tech stack

React 18 (strict mode) · TypeScript · Vite (dev server + build, proxies `/api` → `https://api.oireachtas.ie`) · MUI v5 · TanStack Query v5 · Vitest + Testing Library · Biome

```bash
npm install
npm run dev        # http://localhost:5173, /api proxied — no CORS, no .env
npm run build
npm run lint
npm test
```

## Structure

```
src/
├── api/bills.ts              # fetch + mapping layer
├── components/
│   ├── favorite/FavouriteButton.tsx
│   ├── layout/AppLayout.tsx
│   ├── modal/BillModal.tsx
│   └── BillsTable.tsx
├── context/FavouritesContext.tsx
├── hooks/useBills.ts
├── pages/BillsPage.tsx
├── styles/theme.ts
└── types.ts
```

## Architecture

**API layer** (`api/bills.ts`) — `fetchBills(params?)` hits `/api/v1/legislation` (`limit`, `skip`, `bill_type`). `mapBillRecord(record)` flattens a raw `BillRecord` into a `Bill`: ID is the bill's URI, `billNoDisplay` is `"{billNo}/{billYear}"`, sponsor prefers the named TD over the role label, titles fall back from long → short.

**Data hooks** (`hooks/useBills.ts`) — `useBills({ page, pageSize, typeFilter? })` is server-paginated, converts page/pageSize to skip/limit, and uses `placeholderData: (prev) => prev` to avoid layout shift between pages. `useBillTypes()` fetches the first 1000 bills and returns deduplicated `billType` values, since the API has no dedicated types endpoint.

**Favourites** (`context/FavouritesContext.tsx`) — client-side only, held in React context as `Record<billId, FavouriteEntry>`. Not persisted; resets on refresh. `toggle`, `isFavourite`, `favourites`, and `favouriteIds` are exposed and memoised.

**BillsTable** — the main view. "All Bills" is server-paginated and forwards the type filter as `bill_type`; "Favourites" is entirely client-side with its own independent pagination. Rows are keyboard-accessible (`Enter`/`Space`), and the star column stops click propagation so it doesn't also open the row's modal.

**BillModal** — opens on row click, resets to the English tab on close, and integrates `FavouriteButton` directly against `FavouritesContext`.

**Theme** (`styles/theme.ts`) — parliamentary blue primary, green secondary, amber favourite star.

## Testing

66 tests across 6 files (Vitest + jsdom). `localStorage`, `IntersectionObserver`, and `ResizeObserver` are stubbed globally in `setupTests.ts`.

- **api.test.ts** — `fetchBills` param handling and error cases; `mapBillRecord` as a pure function against fixtures.
- **useBills.test.tsx** — `fetchBills` mocked, `mapBillRecord` real; covers pagination math, `typeFilter` forwarding, error state, and `useBillTypes` dedup.
- **FavouritesContext.test.tsx** — real provider, no mocking; toggle/add/remove and independent tracking across bills.
- **FavouriteButton.test.tsx** — icon state, `aria-label`/`aria-pressed`, click isolation from parent handlers.
- **BillModal.test.tsx** — real `FavouritesProvider`; title fallbacks, language tab behaviour, favourite toggle end-to-end.
- **BillsTable.test.tsx** — `useBills`/`useBillTypes` mocked; skeleton/error/empty states, row interactions, type filter, and client-side favourites filtering.

## Known limitations

- Favourites are in-memory only and lost on refresh.
- `useBillTypes` enumerates types by fetching 1000 bills client-side — would prefer a dedicated API endpoint.
- Search and sort are typed in `types.ts` but not wired up.
- The bill type `Select` lacks a `labelId`/`id` link to its `InputLabel`, so it has no accessible name for screen readers.
- Oireachtas API's `billCount` reflects the filtered total, not the full dataset; changing the type filter resets both tabs to page 0.
