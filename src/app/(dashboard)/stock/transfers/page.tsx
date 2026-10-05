import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { TransfersManager, type TransferRow } from "@/components/transfers/TransfersManager";
import { hasAllStoresScopeForStock } from "@/lib/auth/permissions";
import type { Store } from "@/types/database.types";

export const dynamic = "force-dynamic";

export default async function StockTransfersPage() {
  const profile = await requireRole(["super_admin", "manager", "stock_keeper"]);
  const supabase = createClient();

  let transfersQuery = supabase.from("stock_transfers").select("*").order("created_at", { ascending: false });
  if (!hasAllStoresScopeForStock(profile.role) && profile.store_id) {
    transfersQuery = transfersQuery.or(`from_store_id.eq.${profile.store_id},to_store_id.eq.${profile.store_id}`);
  }

  const [{ data: transfers }, { data: products }, { data: stores }] = await Promise.all([
    transfersQuery,
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    supabase.from("stores").select("*").eq("is_active", true).order("name"),
  ]);

  const storeMap = new Map((stores ?? []).map((s) => [s.id, s.name]));

  const rows: TransferRow[] = (transfers ?? []).map((t) => ({
    id: t.id,
    reference: t.reference,
    status: t.status,
    from_store_name: storeMap.get(t.from_store_id) ?? "—",
    to_store_name: storeMap.get(t.to_store_id) ?? "—",
    created_at: t.created_at,
  }));

  return (
    <TransfersManager
      transfers={rows}
      products={products ?? []}
      stores={(stores as Store[]) ?? []}
      fixedFromStoreId={hasAllStoresScopeForStock(profile.role) ? null : profile.store_id}
    />
  );
}
