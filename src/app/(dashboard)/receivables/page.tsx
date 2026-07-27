import Link from "next/link";
import { HandCoins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReceivablesPage() {
  await requireRole(["super_admin", "manager", "cashier"]);
  const supabase = createClient();

  const { data: receivables } = await supabase
    .from("v_customer_receivables")
    .select("*")
    .gt("total_due", 0)
    .order("total_due", { ascending: false });

  const total = (receivables ?? []).reduce((sum, r) => sum + Number(r.total_due), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Créances clients</h1>
        <p className="mt-1 text-sm text-slate-500">
          {receivables?.length ?? 0} client(s) débiteur(s) — total {formatCurrency(total)}
        </p>
      </div>

      {!receivables || receivables.length === 0 ? (
        <EmptyState icon={HandCoins} title="Aucune créance" description="Tous les clients sont à jour dans leurs paiements." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Client</TH>
              <TH>Téléphone</TH>
              <TH>Ventes impayées</TH>
              <TH>Limite de crédit</TH>
              <TH>Montant dû</TH>
            </TR>
          </THead>
          <TBody>
            {receivables.map((r) => (
              <TR key={r.customer_id}>
                <TD>
                  <Link href={`/receivables/${r.customer_id}`} className="font-medium text-brand-600 hover:underline">
                    {r.customer_name}
                  </Link>
                </TD>
                <TD>{r.phone ?? "—"}</TD>
                <TD>{r.unpaid_sales_count}</TD>
                <TD>{formatCurrency(r.credit_limit)}</TD>
                <TD>
                  <Badge tone={r.total_due > r.credit_limit && r.credit_limit > 0 ? "danger" : "warning"}>
                    {formatCurrency(r.total_due)}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
