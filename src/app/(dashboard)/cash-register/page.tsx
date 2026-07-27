import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { CashRegisterPanel, type JournalRow } from "@/components/cash-register/CashRegisterPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function CashRegisterPage({ searchParams }: { searchParams: { store?: string } }) {
  const profile = await requireRole(["super_admin", "manager", "cashier"]);
  const supabase = createClient();

  const storeId = profile.role === "super_admin" ? searchParams.store : profile.store_id;

  if (!storeId) {
    const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true).order("name");
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Choisir un magasin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(stores ?? []).map((store) => (
            <Link
              key={store.id}
              href={`/cash-register?store=${store.id}`}
              className="block rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50"
            >
              {store.name}
            </Link>
          ))}
        </CardContent>
      </Card>
    );
  }

  const { data: session } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "open")
    .maybeSingle();

  let journal: JournalRow[] = [];
  let runningTotal = 0;

  if (session) {
    const { data: cashMethods } = await supabase.from("payment_methods").select("id").eq("is_cash", true);
    const cashMethodIds = (cashMethods ?? []).map((m) => m.id);

    const [{ data: salePayments }, { data: expenses }, { data: adjustments }] = await Promise.all([
      cashMethodIds.length > 0
        ? supabase
            .from("payments")
            .select("id, amount, payment_date")
            .eq("store_id", storeId)
            .eq("type", "sale_payment")
            .in("payment_method_id", cashMethodIds)
            .gte("payment_date", session.opened_at)
        : Promise.resolve({ data: [] }),
      cashMethodIds.length > 0
        ? supabase
            .from("expenses")
            .select("id, amount, expense_date, description")
            .eq("store_id", storeId)
            .in("payment_method_id", cashMethodIds)
            .gte("created_at", session.opened_at)
        : Promise.resolve({ data: [] }),
      supabase.from("cash_adjustments").select("*").eq("cash_session_id", session.id).order("created_at"),
    ]);

    journal = [
      ...(salePayments ?? []).map((p) => ({
        id: `sp-${p.id}`,
        type: "sale_payment" as const,
        label: "Encaissement vente",
        amount: Number(p.amount),
        date: p.payment_date,
      })),
      ...(expenses ?? []).map((e) => ({
        id: `exp-${e.id}`,
        type: "expense" as const,
        label: `Dépense — ${e.description}`,
        amount: -Number(e.amount),
        date: e.expense_date,
      })),
      ...(adjustments ?? []).map((a) => ({
        id: `adj-${a.id}`,
        type: a.type === "in" ? ("adjustment_in" as const) : ("adjustment_out" as const),
        label: `Ajustement — ${a.reason}`,
        amount: a.type === "in" ? Number(a.amount) : -Number(a.amount),
        date: a.created_at,
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    runningTotal = Number(session.opening_amount) + journal.reduce((sum, row) => sum + row.amount, 0);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Caisse</h1>
        <p className="mt-1 text-sm text-slate-500">{profile.store_name ?? "Sélectionnez un magasin"}</p>
      </div>

      <CashRegisterPanel storeId={storeId} session={session ?? null} journal={journal} runningTotal={runningTotal} />
    </div>
  );
}
