import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import Link from "next/link";
import { StockMovementsTable } from "@/components/stock/StockMovementsTable";
import { MovementsFilterBar } from "@/components/stock/MovementsFilterBar";
import { cn } from "@/lib/utils";
import type { MovementType } from "@/types/database.types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; store_id?: string; from?: string; to?: string; page?: string };
}) {
  const profile = await requireRole(["super_admin", "manager", "stock_keeper"]);
  const supabase = createClient();

  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("v_stock_movements_detail")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (profile.role !== "super_admin" && profile.store_id) {
    query = query.eq("store_id", profile.store_id);
  } else if (searchParams.store_id) {
    query = query.eq("store_id", searchParams.store_id);
  }

  if (searchParams.type) {
    query = query.eq("type", searchParams.type as MovementType);
  }

  if (searchParams.from) {
    query = query.gte("created_at", `${searchParams.from}T00:00:00`);
  }

  if (searchParams.to) {
    query = query.lte("created_at", `${searchParams.to}T23:59:59`);
  }

  if (searchParams.q) {
    const safe = searchParams.q.replace(/[,()%]/g, "").trim();
    if (safe) {
      query = query.or(`product_name.ilike.%${safe}%,sku.ilike.%${safe}%`);
    }
  }

  const [{ data: movements, count }, { data: stores }] = await Promise.all([
    query,
    profile.role === "super_admin" ? supabase.from("stores").select("*").order("name") : Promise.resolve({ data: [] }),
  ]);

  const reversedIds = new Set((movements ?? []).filter((m) => m.reversal_of).map((m) => m.reversal_of as string));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams(searchParams as Record<string, string>);
    params.set("page", String(p));
    return `/stock/movements?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Journal des mouvements</h1>
        <p className="mt-1 text-sm text-slate-500">
          {count ?? 0} mouvement(s) — historique complet, immuable et traçable.
        </p>
      </div>

      <MovementsFilterBar stores={stores ?? []} showStore={profile.role === "super_admin"} />

      <StockMovementsTable
        movements={movements ?? []}
        showStore={profile.role === "super_admin"}
        reversedIds={reversedIds}
        canReverse={false}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Link
              href={page <= 1 ? "#" : buildPageHref(page - 1)}
              aria-disabled={page <= 1}
              className={cn(
                "inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50",
                page <= 1 && "pointer-events-none opacity-50"
              )}
            >
              Précédent
            </Link>
            <Link
              href={page >= totalPages ? "#" : buildPageHref(page + 1)}
              aria-disabled={page >= totalPages}
              className={cn(
                "inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50",
                page >= totalPages && "pointer-events-none opacity-50"
              )}
            >
              Suivant
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
