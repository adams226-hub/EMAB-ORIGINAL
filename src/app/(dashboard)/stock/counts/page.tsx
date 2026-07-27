import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { CountsManager, type CountRow } from "@/components/counts/CountsManager";
import type { Store } from "@/types/database.types";

export const dynamic = "force-dynamic";

export default async function StockCountsPage() {
  const profile = await requireRole(["super_admin", "manager", "stock_keeper"]);
  const supabase = createClient();

  let countsQuery = supabase.from("stock_counts").select("*").order("created_at", { ascending: false });
  if (profile.role !== "super_admin" && profile.store_id) {
    countsQuery = countsQuery.eq("store_id", profile.store_id);
  }

  const [{ data: counts }, { data: stores }] = await Promise.all([
    countsQuery,
    supabase.from("stores").select("*").eq("is_active", true).order("name"),
  ]);

  const storeMap = new Map((stores as Store[] ?? []).map((s) => [s.id, s.name]));

  const rows: CountRow[] = (counts ?? []).map((c) => ({
    ...c,
    store_name: storeMap.get(c.store_id) ?? "—",
  }));

  return (
    <CountsManager
      counts={rows}
      stores={stores ?? []}
      fixedStoreId={profile.role === "super_admin" ? null : profile.store_id}
    />
  );
}
