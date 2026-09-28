import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ManualMovementManager } from "@/components/stock/ManualMovementManager";
import { StockStoreFilter } from "@/components/stock/StockStoreFilter";
import { hasAllStoresScope } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function StockOutPage({ searchParams }: { searchParams: { store_id?: string } }) {
  const profile = await requireRole(["super_admin", "manager", "stock_keeper"]);
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

  const [{ data: movements }, { data: products }, { data: stores }] = await Promise.all([
    movementsQuery,
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    canFilterByStore
      ? supabase.from("stores").select("*").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <ManualMovementManager
      kind="out"
      movements={movements ?? []}
      products={products ?? []}
      stores={stores ?? []}
      fixedStoreId={canFilterByStore ? null : profile.store_id}
      canReverse
      storeFilter={canFilterByStore ? <StockStoreFilter stores={stores ?? []} /> : undefined}
    />
  );
}
