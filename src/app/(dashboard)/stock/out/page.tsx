import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ManualMovementManager } from "@/components/stock/ManualMovementManager";

export const dynamic = "force-dynamic";

export default async function StockOutPage() {
  const profile = await requireRole(["super_admin", "manager", "stock_keeper"]);
  const supabase = createClient();

  let movementsQuery = supabase
    .from("v_stock_movements_detail")
    .select("*")
    .eq("type", "out")
    .order("created_at", { ascending: false })
    .limit(200);

  if (profile.role !== "super_admin" && profile.store_id) {
    movementsQuery = movementsQuery.eq("store_id", profile.store_id);
  }

  const [{ data: movements }, { data: products }, { data: stores }] = await Promise.all([
    movementsQuery,
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    profile.role === "super_admin"
      ? supabase.from("stores").select("*").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <ManualMovementManager
      kind="out"
      movements={movements ?? []}
      products={products ?? []}
      stores={stores ?? []}
      fixedStoreId={profile.role === "super_admin" ? null : profile.store_id}
      canReverse
    />
  );
}
