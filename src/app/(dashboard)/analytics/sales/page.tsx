import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { resolveAnalyticsFilter, type AnalyticsSearchParams } from "@/lib/analytics/resolve-filter";
import { getSalesTrend } from "@/lib/analytics/sales";
import { AnalyticsFilterBar } from "@/components/analytics/AnalyticsFilterBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { TrendChart } from "@/components/charts/TrendChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TrendingUp, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SalesAnalyticsPage({ searchParams }: { searchParams: AnalyticsSearchParams }) {
  const profile = await requireRole(["super_admin", "manager"]);
  const supabase = createClient();
  const filter = resolveAnalyticsFilter(searchParams, profile);

  const [{ data: stores }, trend] = await Promise.all([
    profile.role === "super_admin" ? supabase.from("stores").select("*").eq("is_active", true).order("name") : Promise.resolve({ data: [] }),
    getSalesTrend(supabase, filter),
  ]);

  const exportParams = new URLSearchParams({ from: filter.from, to: filter.to });
  if (filter.storeId) exportParams.set("store_id", filter.storeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Rapport ventes</h1>
          <p className="mt-1 text-sm text-slate-500">Évolution et tendances du chiffre d&apos;affaires</p>
        </div>
        <a
          href={`/api/reports/sales?${exportParams.toString()}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Download className="h-4 w-4" />
          Exporter Excel
        </a>
      </div>

      <AnalyticsFilterBar preset={filter.preset} from={filter.from} to={filter.to} stores={stores ?? []} showStore={profile.role === "super_admin"} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Chiffre d'affaires"
          value={formatCurrency(trend.totalRevenue)}
          icon={TrendingUp}
          tone="success"
          hint={
            trend.revenueGrowth === null
              ? "Pas de données comparables"
              : `${trend.revenueGrowth >= 0 ? "+" : ""}${trend.revenueGrowth}% vs période précédente (${formatCurrency(trend.previousRevenue)})`
          }
        />
        <StatCard label="Transactions" value={String(trend.totalTransactions)} icon={Receipt} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Évolution du chiffre d&apos;affaires</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={trend.points}
            xKey="label"
            series={[{ key: "revenue", label: "Chiffre d'affaires" }]}
            format="currency"
            height={340}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Détail par période</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Période</TH>
                <TH>Transactions</TH>
                <TH>Chiffre d&apos;affaires</TH>
              </TR>
            </THead>
            <TBody>
              {trend.points.map((p) => (
                <TR key={p.label}>
                  <TD className="font-medium text-slate-900">{p.label}</TD>
                  <TD>{p.transactions}</TD>
                  <TD>{formatCurrency(p.revenue)}</TD>
                </TR>
              ))}
              {trend.points.length === 0 && (
                <TR>
                  <TD colSpan={3} className="text-center text-sm text-slate-400">
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
