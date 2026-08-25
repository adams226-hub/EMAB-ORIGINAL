import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface FinancialSummary {
  revenue: number;
  cogs: number;
  grossMargin: number;
  netProfit: number;
}

export async function getFinancialSummary(
  supabase: SupabaseClient<Database>,
  { storeId, from, to }: { storeId: string | null; from: string; to: string }
): Promise<FinancialSummary> {
  let salesQuery = supabase
    .from("sales")
    .select("id, total_amount")
    .eq("status", "completed")
    .gte("sale_date", `${from}T00:00:00`)
    .lte("sale_date", `${to}T23:59:59`);

  if (storeId) {
    salesQuery = salesQuery.eq("store_id", storeId);
  }

  const { data: sales } = await salesQuery;

  const saleIds = (sales ?? []).map((s) => s.id);
  const { data: saleItems } = saleIds.length
    ? await supabase.from("sale_items").select("quantity, unit_cost").in("sale_id", saleIds)
    : { data: [] };

  const revenue = (sales ?? []).reduce((sum, s) => sum + Number(s.total_amount), 0);
  const cogs = (saleItems ?? []).reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_cost), 0);
  const grossMargin = revenue - cogs;

  return { revenue, cogs, grossMargin, netProfit: grossMargin };
}
