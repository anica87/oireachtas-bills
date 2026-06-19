import { useAllBills } from "./useAllBills";

export function useBillTypes(): string[] {
  const { data: bills } = useAllBills();
  if (!bills) return [];
  return Array.from(new Set(bills.map((b) => b.billType).filter(Boolean))).sort();
}