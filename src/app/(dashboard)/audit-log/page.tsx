import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { AuditLogTable } from "@/components/audit/AuditLogTable";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { table?: string; page?: string };
}) {
  await requireRole(["super_admin"]);
  const supabase = createClient();

  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("v_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (searchParams.table) query = query.eq("table_name", searchParams.table);

  const { data: entries, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Journal d&apos;audit</h1>
        <p className="mt-1 text-sm text-slate-500">{count ?? 0} évènement(s) — création, modification, suppression</p>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <Select name="table" defaultValue={searchParams.table ?? ""} className="w-56">
          <option value="">Toutes les entités</option>
          <option value="stores">Magasins</option>
          <option value="profiles">Utilisateurs</option>
          <option value="products">Produits</option>
          <option value="customers">Clients</option>
          <option value="sales">Ventes</option>
          <option value="stock_counts">Inventaires</option>
        </Select>
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>

      <AuditLogTable entries={entries ?? []} />

      {totalPages > 1 && (
        <p className="text-sm text-slate-500">
          Page {page} / {totalPages}
        </p>
      )}
    </div>
  );
}
