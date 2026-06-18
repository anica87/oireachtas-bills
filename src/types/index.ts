import type React from "react";

// Raw API response shapes

export interface ApiSponsorEntry {
  sponsor: {
    as: {
      showAs: string;
      uri: string;
    };
    by?: {
      showAs: string;
      uri: string;
      memberCode?: string;
    };
  };
}

export interface BillRecord {
  bill: {
    billNo: string;
    billYear: string;
    billType: string;
    status: string;
    shortTitleEn: string;
    shortTitleGa: string;
    longTitleEn?: string;
    longTitleGa?: string;
    sponsors: ApiSponsorEntry[];
    uri: string;
    originHouse?: {
      showAs: string;
      uri: string;
    };
    method?: string;
  };
}

export interface BillsApiResponse {
  head: {
    counts: {
      billCount: number;
    };
    dateRange?: {
      start: string;
      end: string;
    };
  };
  results: BillRecord[];
}

// Domain models

export interface Bill {
  id: string;
  billNo: string;
  billYear: string;
  billNoDisplay: string;
  billType: string;
  status: string;
  shortTitleEn: string;
  shortTitleGa: string;
  longTitleEn: string;
  longTitleGa: string;
  sponsor: string;
  originHouse: string;
  uri: string;
}

export interface BillFilters {
  billType: string;
  billStatus: string;
  originHouse: string;
  search: string;
}

export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type FavouriteStatus = "idle" | "loading" | "success" | "error";

export interface FavouriteEntry {
  billId: string;
  isFavourite: boolean;
  status: FavouriteStatus;
}

// Table

export type SortDirection = "asc" | "desc" | false;

export interface ColumnDef<TData> {
  key: string;
  header: string;
  sortKey?: string | false;
  cell: (row: TData) => React.ReactNode;
  minWidth?: string;
  width?: string;
}

export interface SortState {
  key: string;
  direction: SortDirection;
}

// Utility types

export type InferFetchResult<T extends (...args: never[]) => Promise<unknown>> =
  T extends (...args: never[]) => Promise<infer R> ? R : never;

export type RequiredNonNullable<T> = {
  [K in keyof T]-?: NonNullable<T[K]>;
};

export type ArrayElement<T extends readonly unknown[]> =
  T extends ReadonlyArray<infer E> ? E : never;
