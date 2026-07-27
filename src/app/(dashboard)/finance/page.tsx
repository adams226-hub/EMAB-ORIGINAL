import { TrendingUp, TrendingDown, Wallet, HandCoins, PiggyBank } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { PeriodFilterBar } from "@/components/finance/PeriodFilterBar";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

function defaultPeriod() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default async function FinancialDashboardPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const profile = await requireRole(["super_admin", "manager"]);
  const supabase = createClient();

  const defaults = defaultPeriod();
  const from = searchParams.from ?? defaults.from;
  const to = searchParams.to ?? defaults.to;

  let salesQuery = supabase
    .from("sales")
    .select("id, total_amount")
    .eq("status", "completed")
    .gte("sale_date", `${from}T00:00:00`)
    .lte("sale_date", `${to}T23:59:59`);

  let expensesQuery = supabase
    .from("expenses")
    .select("amount")
    .gte("expense_date", from)
    .lte("expense_date", to);

  if (profile.role !== "super_admin" && profile.store_id) {
    salesQuery = salesQuery.eq("store_id", profile.store_id);
    expensesQuery = expensesQuery.eq("store_id", profile.store_id);
  }

  const [{ data: sales }, { data: expenses }, { data: receivables }] = await Promise.all([
    salesQuery,
    expensesQuery,
    supabase.from("v_customer_receivables").select("total_due"),
  ]);

  const saleIds = (sales ?? []).map((s) => s.id);
  const { data: saleItems } = saleIds.length
    ? await supabase
        .from("sale_items")
        .select("product_id, quantity, unit_cost, line_total, products ( name, sku )")
        .in("sale_id", saleIds)
    : { data: [] };

  const revenue = (sales ?? []).reduce((sum, s) => sum + Number(s.total_amount), 0);
  const expensesTotal = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  type ItemWithProduct = {
    product_id: string;
    quantity: number;
    unit_cost: number;
    line_total: number;
    products: { name: string; sku: string } | null;
  };

  const items = (saleItems ?? []) as unknown as ItemWithProduct[];
  const cogs = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_cost), 0);
  const grossMargin = revenue - cogs;
  const netProfit = grossMargin - expensesTotal;

  const marginByProduct = new Map<string, { name: string; sku: string; revenue: number; cost: number }>();
  for (const item of items) {
    const key = item.product_id;
    const entry = marginByProduct.get(key) ?? {
      name: item.products?.name ?? "—",
      sku: item.products?.sku ?? "—",
      revenue: 0,
      cost: 0,
    };
    entry.revenue += Number(item.line_total);
    entry.cost += Number(item.quantity) * Number(item.unit_cost);
    marginByProduct.set(key, entry);
  }

  const topMargins = Array.from(marginByProduct.values())
    .map((p) => ({ ...p, margin: p.revenue - p.cost }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 10);

  const totalReceivables = (receivables ?? []).reduce((sum, r) => sum + Number(r.total_due), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard financier</h1>
        <p className="mt-1 text-sm text-slate-500">{profile.store_name ?? "Tous les magasins"}</p>
      </div>

      <PeriodFilterBar from={from} to={to} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Chiffre d'affaires" value={formatCurrency(revenue)} icon={TrendingUp} tone="success" />
        <StatCard label="Coût des marchandises vendues" value={formatCurrency(cogs)} icon={TrendingDown} tone="warning" />
        <StatCard label="Dépenses" value={formatCurrency(expensesTotal)} icon={Wallet} tone="warning" />
        <StatCard
          label="Bénéfice net"
          value={formatCurrency(netProfit)}
          icon={PiggyBank}
          tone={netProfit >= 0 ? "success" : "warning"}
          hint="Ventes − coût d'achat − dépenses"
        />
        <StatCard label="Créances clients en cours" value={formatCurrency(totalReceivables)} icon={HandCoins} tone="warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meilleures marges par produit</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Produit</TH>
                <TH>Chiffre d&apos;affaires</TH>
                <TH>Coût</TH>
                <TH>Marge</TH>
              </TR>
            </THead>
            <TBody>
              {topMargins.map((p) => (
                <TR key={p.sku}>
                  <TD>
                    <div className="font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.sku}</div>
                  </TD>
                  <TD>{formatCurrency(p.revenue)}</TD>
                  <TD>{formatCurrency(p.cost)}</TD>
                  <TD className="font-medium text-emerald-600">{formatCurrency(p.margin)}</TD>
                </TR>
              ))}
              {topMargins.length === 0 && (
                <TR>
                  <TD colSpan={4} className="text-center text-sm text-slate-400">
                    Aucune vente sur cette période
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
