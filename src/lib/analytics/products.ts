import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface ProductPerformanceRow {
  product_id: string;
  product_name: string;
  sku: string;
  category_name: string | null;
  quantity_sold: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number;
}

type ItemWithProduct = {
  product_id: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  products: { name: string; sku: string; category_id: string | null; categories: { name: string } | null } | null;
};

export async function getProductPerformance(
  supabase: SupabaseClient<Database>,
  { storeId, from, to }: { storeId: string | null; from: string; to: string }
): Promise<ProductPerformanceRow[]> {
  let salesQuery = supabase
    .from("sales")
    .select("id")
    .eq("status", "completed")
    .gte("sale_date", `${from}T00:00:00`)
    .lte("sale_date", `${to}T23:59:59`);

  if (storeId) salesQuery = salesQuery.eq("store_id", storeId);

  const { data: sales } = await salesQuery;
  const saleIds = (sales ?? []).map((s) => s.id);
  if (saleIds.length === 0) return [];

  const { data: items } = await supabase
    .from("sale_items")
    .select("product_id, quantity, unit_cost, line_total, products ( name, sku, category_id, categories ( name ) )")
    .in("sale_id", saleIds);

  const byProduct = new Map<string, ProductPerformanceRow>();
  for (const raw of (items ?? []) as unknown as ItemWithProduct[]) {
    const entry = byProduct.get(raw.product_id) ?? {
      product_id: raw.product_id,
      product_name: raw.products?.name ?? "—",
      sku: raw.products?.sku ?? "—",
      category_name: raw.products?.categories?.name ?? null,
      quantity_sold: 0,
      revenue: 0,
      cost: 0,
      margin: 0,
      marginPercent: 0,
    };
    entry.quantity_sold += Number(raw.quantity);
    entry.revenue += Number(raw.line_total);
    entry.cost += Number(raw.quantity) * Number(raw.unit_cost);
    byProduct.set(raw.product_id, entry);
  }

  return Array.from(byProduct.values()).map((p) => ({
    ...p,
    revenue: Math.round(p.revenue * 100) / 100,
    cost: Math.round(p.cost * 100) / 100,
    margin: Math.round((p.revenue - p.cost) * 100) / 100,
    marginPercent: p.revenue > 0 ? Math.round(((p.revenue - p.cost) / p.revenue) * 1000) / 10 : 0,
  }));
}
