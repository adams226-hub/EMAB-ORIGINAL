import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface StorePerformanceRow {
  store_id: string;
  store_name: string;
  revenue: number;
  transactions: number;
  avgTicket: number;
  cogs: number;
  expenses: number;
  profit: number;
}

export async function getStorePerformance(
  supabase: SupabaseClient<Database>,
  { from, to }: { from: string; to: string }
): Promise<StorePerformanceRow[]> {
  const [{ data: stores }, { data: sales }, { data: expenses }] = await Promise.all([
    supabase.from("stores").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("sales")
      .select("id, store_id, total_amount")
      .eq("status", "completed")
      .gte("sale_date", `${from}T00:00:00`)
      .lte("sale_date", `${to}T23:59:59`),
    supabase.from("expenses").select("store_id, amount").gte("expense_date", from).lte("expense_date", to),
  ]);

  const saleIds = (sales ?? []).map((s) => s.id);
  const { data: saleItems } = saleIds.length
    ? await supabase.from("sale_items").select("sale_id, quantity, unit_cost").in("sale_id", saleIds)
    : { data: [] };

  const cogsBySale = new Map<string, number>();
  for (const item of saleItems ?? []) {
    cogsBySale.set(item.sale_id, (cogsBySale.get(item.sale_id) ?? 0) + Number(item.quantity) * Number(item.unit_cost));
  }

  const metrics = new Map<string, { revenue: number; transactions: number; cogs: number; expenses: number }>();
  for (const store of stores ?? []) {
    metrics.set(store.id, { revenue: 0, transactions: 0, cogs: 0, expenses: 0 });
  }

  for (const sale of sales ?? []) {
    const entry = metrics.get(sale.store_id);
    if (!entry) continue;
    entry.revenue += Number(sale.total_amount);
    entry.transactions += 1;
    entry.cogs += cogsBySale.get(sale.id) ?? 0;
  }

  for (const expense of expenses ?? []) {
    const entry = metrics.get(expense.store_id);
    if (entry) entry.expenses += Number(expense.amount);
  }

  return (stores ?? []).map((store) => {
    const m = metrics.get(store.id)!;
    return {
      store_id: store.id,
      store_name: store.name,
      revenue: Math.round(m.revenue * 100) / 100,
      transactions: m.transactions,
      avgTicket: m.transactions > 0 ? Math.round((m.revenue / m.transactions) * 100) / 100 : 0,
      cogs: Math.round(m.cogs * 100) / 100,
      expenses: Math.round(m.expenses * 100) / 100,
      profit: Math.round((m.revenue - m.cogs - m.expenses) * 100) / 100,
    };
  });
}
