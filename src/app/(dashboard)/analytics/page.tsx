import { Download, TrendingUp, Receipt, AlertTriangle, HandCoins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { resolveAnalyticsFilter, type AnalyticsSearchParams } from "@/lib/analytics/resolve-filter";
import { getSalesTrend } from "@/lib/analytics/sales";
import { getStorePerformance } from "@/lib/analytics/stores";
import { getProductPerformance } from "@/lib/analytics/products";
import { getAnalyticalAlerts } from "@/lib/analytics/alerts";
import { AnalyticsFilterBar } from "@/components/analytics/AnalyticsFilterBar";
import { AlertsPanel } from "@/components/analytics/AlertsPanel";
import { RealtimeAnalyticsWatcher } from "@/components/analytics/RealtimeAnalyticsWatcher";
import { StatCard } from "@/components/dashboard/StatCard";
import { TrendChart } from "@/components/charts/TrendChart";
import { ComparisonBarChart } from "@/components/charts/ComparisonBarChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalyticsDashboardPage({ searchParams }: { searchParams: AnalyticsSearchParams }) {
  const profile = await requireRole(["super_admin", "manager"]);
  const supabase = createClient();
  const filter = resolveAnalyticsFilter(searchParams, profile);

  const [{ data: stores }, trend, storePerf, products, alerts, { data: receivables }, { data: lowStock }] =
    await Promise.all([
      profile.role === "super_admin" ? supabase.from("stores").select("*").eq("is_active", true).order("name") : Promise.resolve({ data: [] }),
      getSalesTrend(supabase, filter),
      profile.role === "super_admin" ? getStorePerformance(supabase, filter) : Promise.resolve([]),
      getProductPerformance(supabase, filter),
      getAnalyticalAlerts(supabase, { storeId: filter.storeId }),
      supabase.from("v_customer_receivables").select("total_due"),
      supabase.from("v_stock_alerts").select("product_id"),
    ]);

  const topProducts = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const totalReceivables = (receivables ?? []).reduce((sum, r) => sum + Number(r.total_due), 0);

  const exportParams = new URLSearchParams({ from: filter.from, to: filter.to });
  if (filter.storeId) exportParams.set("store_id", filter.storeId);

  return (
    <div className="space-y-6">
      <RealtimeAnalyticsWatcher />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard analytique</h1>
          <p className="mt-1 text-sm text-slate-500">{profile.store_name ?? "Tous les magasins"} — pilotage global</p>
        </div>
        <a
          href={`/api/reports/sales?${exportParams.toString()}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Download className="h-4 w-4" />
          Télécharger le rapport (Excel)
        </a>
      </div>

      <AnalyticsFilterBar preset={filter.preset} from={filter.from} to={filter.to} stores={stores ?? []} showStore={profile.role === "super_admin"} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Chiffre d'affaires"
          value={formatCurrency(trend.totalRevenue)}
          icon={TrendingUp}
          tone="success"
          hint={
            trend.revenueGrowth === null
              ? undefined
              : `${trend.revenueGrowth >= 0 ? "+" : ""}${trend.revenueGrowth}% vs période précédente`
          }
        />
        <StatCard label="Transactions" value={String(trend.totalTransactions)} icon={Receipt} />
        <StatCard label="Alertes actives" value={String(alerts.length)} icon={AlertTriangle} tone={alerts.length > 0 ? "warning" : "success"} />
        <StatCard label="Créances clients" value={formatCurrency(totalReceivables)} icon={HandCoins} tone="warning" />
        <StatCard label="Produits en alerte stock" value={String(lowStock?.length ?? 0)} icon={AlertTriangle} tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Évolution du chiffre d&apos;affaires</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={trend.points}
              xKey="label"
              series={[{ key: "revenue", label: "Chiffre d'affaires" }]}
              format="currency"
            />
          </CardContent>
        </Card>

        <AlertsPanel alerts={alerts} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {profile.role === "super_admin" && storePerf.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Comparaison des magasins</CardTitle>
            </CardHeader>
            <CardContent>
              <ComparisonBarChart
                data={storePerf.map((s) => ({ name: s.store_name, revenue: s.revenue }))}
                categoryKey="name"
                series={[{ key: "revenue", label: "Chiffre d'affaires" }]}
                format="currency"
                height={Math.max(200, storePerf.length * 40)}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Top 5 produits</CardTitle>
          </CardHeader>
          <CardContent>
            <ComparisonBarChart
              data={topProducts.map((p) => ({ name: p.product_name, revenue: p.revenue }))}
              categoryKey="name"
              series={[{ key: "revenue", label: "Chiffre d'affaires" }]}
              format="currency"
              height={Math.max(200, topProducts.length * 40)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
