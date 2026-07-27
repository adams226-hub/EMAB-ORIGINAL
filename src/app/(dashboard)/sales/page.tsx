import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { SalesFilterBar } from "@/components/sales/SalesFilterBar";
import { PaymentStatusBadge } from "@/components/sales/PaymentStatusBadge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Receipt } from "lucide-react";
import type { PaymentStatus } from "@/types/database.types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; store_id?: string; from?: string; to?: string; page?: string };
}) {
  const profile = await requireRole(["super_admin", "manager", "cashier"]);
  const supabase = createClient();

  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("v_sales_detail")
    .select("*", { count: "exact" })
    .order("sale_date", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (profile.role !== "super_admin" && profile.store_id) {
    query = query.eq("store_id", profile.store_id);
  } else if (searchParams.store_id) {
    query = query.eq("store_id", searchParams.store_id);
  }

  if (searchParams.status) {
    query = query.eq("payment_status", searchParams.status as PaymentStatus);
  }

  if (searchParams.from) query = query.gte("sale_date", `${searchParams.from}T00:00:00`);
  if (searchParams.to) query = query.lte("sale_date", `${searchParams.to}T23:59:59`);

  if (searchParams.q) {
    const safe = searchParams.q.replace(/[,()%]/g, "").trim();
    if (safe) query = query.or(`reference.ilike.%${safe}%,customer_name.ilike.%${safe}%`);
  }

  const [{ data: sales, count }, { data: stores }] = await Promise.all([
    query,
    profile.role === "super_admin" ? supabase.from("stores").select("*").order("name") : Promise.resolve({ data: [] }),
  ]);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams(searchParams as Record<string, string>);
    params.set("page", String(p));
    return `/sales?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ventes</h1>
        <p className="mt-1 text-sm text-slate-500">{count ?? 0} vente(s)</p>
      </div>

      <SalesFilterBar stores={stores ?? []} showStore={profile.role === "super_admin"} />

      {!sales || sales.length === 0 ? (
        <EmptyState icon={Receipt} title="Aucune vente" description="Aucune vente ne correspond à ces critères." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Référence</TH>
              <TH>Date</TH>
              <TH>Client</TH>
              {profile.role === "super_admin" && <TH>Magasin</TH>}
              <TH>Total</TH>
              <TH>Solde dû</TH>
              <TH>Statut</TH>
            </TR>
          </THead>
          <TBody>
            {sales.map((sale) => (
              <TR key={sale.id}>
                <TD>
                  <Link href={`/sales/${sale.id}`} className="font-medium text-brand-600 hover:underline">
                    {sale.reference}
                  </Link>
                </TD>
                <TD className="text-sm text-slate-500">{formatDate(sale.sale_date)}</TD>
                <TD>{sale.customer_name ?? "Client de passage"}</TD>
                {profile.role === "super_admin" && <TD>{sale.store_name}</TD>}
                <TD className="font-medium">{formatCurrency(sale.total_amount)}</TD>
                <TD className={cn(sale.amount_due > 0 && "font-medium text-amber-600")}>
                  {formatCurrency(sale.amount_due)}
                </TD>
                <TD>
                  <PaymentStatusBadge status={sale.payment_status} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Link
              href={page <= 1 ? "#" : buildPageHref(page - 1)}
              className={cn(
                "inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50",
                page <= 1 && "pointer-events-none opacity-50"
              )}
            >
              Précédent
            </Link>
            <Link
              href={page >= totalPages ? "#" : buildPageHref(page + 1)}
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
