import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ManualMovementManager } from "@/components/stock/ManualMovementManager";
import { StockStoreFilter } from "@/components/stock/StockStoreFilter";
import { StockTotalsByProduct, type StockTotalByProductRow } from "@/components/stock/StockTotalsByProduct";
import { hasAllStoresScope } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function StockOutPage({ searchParams }: { searchParams: { store_id?: string } }) {
  const profile = await requireRole(["super_admin"]);
  const supabase = createClient();

  const canFilterByStore = hasAllStoresScope(profile.role);
  const filterStoreId = canFilterByStore ? searchParams.store_id || null : profile.store_id;

  let movementsQuery = supabase
    .from("v_stock_movements_detail")
    .select("*")
    .eq("type", "out")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filterStoreId) {
    movementsQuery = movementsQuery.eq("store_id", filterStoreId);
  }

  let totalsQuery = supabase.from("v_stock_movements_detail").select("product_name, sku, quantity").eq("type", "out").limit(5000);
  if (filterStoreId) {
    totalsQuery = totalsQuery.eq("store_id", filterStoreId);
  }

  const [{ data: movements }, { data: products }, { data: stores }, { data: totalsRows }] = await Promise.all([
    movementsQuery,
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    canFilterByStore
      ? supabase.from("stores").select("*").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] }),
    totalsQuery,
  ]);

  const totalsMap = new Map<string, StockTotalByProductRow>();
  for (const row of totalsRows ?? []) {
    const key = row.sku || row.product_name;
    const existing = totalsMap.get(key);
    if (existing) {
      existing.quantity += Number(row.quantity);
    } else {
      totalsMap.set(key, { product_name: row.product_name, sku: row.sku, quantity: Number(row.quantity) });
    }
  }
  const totals = Array.from(totalsMap.values()).sort((a, b) => b.quantity - a.quantity);

  return (
    <ManualMovementManager
      kind="out"
      role={profile.role}
      movements={movements ?? []}
      products={products ?? []}
      stores={stores ?? []}
      fixedStoreId={canFilterByStore ? null : profile.store_id}
      canReverse
      storeFilter={canFilterByStore ? <StockStoreFilter stores={stores ?? []} /> : undefined}
      totalsByProduct={<StockTotalsByProduct title="Totaux sorties par produit" rows={totals} />}
    />
  );
}
