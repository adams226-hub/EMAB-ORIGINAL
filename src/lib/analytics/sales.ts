import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { growthPercent } from "./period";

export interface SalesTrendPoint {
  label: string;
  revenue: number;
  transactions: number;
}

export interface SalesTrendResult {
  points: SalesTrendPoint[];
  totalRevenue: number;
  totalTransactions: number;
  previousRevenue: number;
  revenueGrowth: number | null;
}

function bucketKey(date: Date, granularity: "day" | "week" | "month"): string {
  if (granularity === "month") return date.toISOString().slice(0, 7);
  if (granularity === "week") {
    const monday = new Date(date);
    const day = monday.getDay() === 0 ? 7 : monday.getDay();
    monday.setDate(monday.getDate() - (day - 1));
    return monday.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function pickGranularity(from: string, to: string): "day" | "week" | "month" {
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  if (days <= 31) return "day";
  if (days <= 180) return "week";
  return "month";
}

export async function getSalesTrend(
  supabase: SupabaseClient<Database>,
  { storeId, from, to, previousFrom, previousTo }: { storeId: string | null; from: string; to: string; previousFrom: string; previousTo: string }
): Promise<SalesTrendResult> {
  let currentQuery = supabase
    .from("sales")
    .select("sale_date, total_amount")
    .eq("status", "completed")
    .gte("sale_date", `${from}T00:00:00`)
    .lte("sale_date", `${to}T23:59:59`);

  let previousQuery = supabase
    .from("sales")
    .select("total_amount")
    .eq("status", "completed")
    .gte("sale_date", `${previousFrom}T00:00:00`)
    .lte("sale_date", `${previousTo}T23:59:59`);

  if (storeId) {
    currentQuery = currentQuery.eq("store_id", storeId);
    previousQuery = previousQuery.eq("store_id", storeId);
  }

  const [{ data: current }, { data: previous }] = await Promise.all([currentQuery, previousQuery]);

  const granularity = pickGranularity(from, to);
  const buckets = new Map<string, { revenue: number; transactions: number }>();

  for (const sale of current ?? []) {
    const key = bucketKey(new Date(sale.sale_date), granularity);
    const entry = buckets.get(key) ?? { revenue: 0, transactions: 0 };
    entry.revenue += Number(sale.total_amount);
    entry.transactions += 1;
    buckets.set(key, entry);
  }

  const points: SalesTrendPoint[] = Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([label, v]) => ({ label, revenue: Math.round(v.revenue * 100) / 100, transactions: v.transactions }));

  const totalRevenue = (current ?? []).reduce((sum, s) => sum + Number(s.total_amount), 0);
  const totalTransactions = (current ?? []).length;
  const previousRevenue = (previous ?? []).reduce((sum, s) => sum + Number(s.total_amount), 0);

  return {
    points,
    totalRevenue,
    totalTransactions,
    previousRevenue,
    revenueGrowth: growthPercent(totalRevenue, previousRevenue),
  };
}
