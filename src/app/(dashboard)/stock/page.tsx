import { Warehouse, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StockMovementsTable } from "@/components/stock/StockMovementsTable";
import { RealtimeStockWatcher } from "@/components/stock/RealtimeStockWatcher";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StockDashboardPage() {
  const profile = await requireRole(["super_admin", "manager", "stock_keeper"]);
  const supabase = createClient();

  const [{ data: alerts }, { data: recentMovements }, { data: overview }] = await Promise.all([
    supabase.from("v_stock_alerts").select("*").order("quantity"),
    supabase.from("v_stock_movements_detail").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("v_products_overview").select("total_stock, sale_price"),
  ]);

  const rows = overview ?? [];
  const totalStockUnits = rows.reduce((sum, r) => sum + Number(r.total_stock), 0);
  const stockValue = rows.reduce((sum, r) => sum + Number(r.total_stock) * Number(r.sale_price), 0);

  return (
    <div className="space-y-6">
      <RealtimeStockWatcher />

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Vue d'ensemble du stock</h1>
        <p className="mt-1 text-sm text-slate-500">
          {profile.store_name ?? "Tous les magasins"} — mise à jour en temps réel
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Unités en stock" value={totalStockUnits.toLocaleString("fr-FR")} icon={Warehouse} />
        <StatCard label="Valeur du stock" value={formatCurrency(stockValue)} icon={Warehouse} tone="success" />
        <StatCard
          label="Alertes stock bas"
          value={String(alerts?.length ?? 0)}
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alertes stock bas</CardTitle>
          </CardHeader>
          <CardContent>
            {!alerts || alerts.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="Aucune alerte" description="Tous les produits sont au-dessus de leur seuil." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Produit</TH>
                    <TH>Magasin</TH>
                    <TH>Stock</TH>
                    <TH>Seuil</TH>
                  </TR>
                </THead>
                <TBody>
                  {alerts.map((a) => (
                    <TR key={`${a.product_id}-${a.store_id}`}>
                      <TD>
                        <div className="font-medium text-slate-900">{a.product_name}</div>
                        <div className="text-xs text-slate-400">{a.sku}</div>
                      </TD>
                      <TD>{a.store_name}</TD>
                      <TD>
                        <Badge tone="danger">{a.quantity}</Badge>
                      </TD>
                      <TD className="text-slate-500">{a.alert_threshold}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Derniers mouvements</CardTitle>
          </CardHeader>
          <CardContent>
            <StockMovementsTable
              movements={recentMovements ?? []}
              showStore={profile.role === "super_admin"}
              reversedIds={new Set()}
              canReverse={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
