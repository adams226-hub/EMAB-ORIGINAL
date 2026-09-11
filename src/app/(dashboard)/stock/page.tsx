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
import { StockStoreFilter } from "@/components/stock/StockStoreFilter";
import { formatCurrency } from "@/lib/utils";
import { hasAllStoresScope } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function StockDashboardPage({
  searchParams,
}: {
  searchParams: { store_id?: string };
}) {
  const profile = await requireRole(["super_admin", "manager", "cashier", "stock_keeper"]);
  const supabase = createClient();

  const canFilterByStore = hasAllStoresScope(profile.role);
  const storeId = canFilterByStore ? searchParams.store_id || null : profile.store_id;

  let alertsQuery = supabase.from("v_stock_alerts").select("*").order("quantity");
  let movementsQuery = supabase
    .from("v_stock_movements_detail")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  let stockQuery = supabase.from("product_stock").select("quantity, products ( sale_price )");

  if (storeId) {
    alertsQuery = alertsQuery.eq("store_id", storeId);
    movementsQuery = movementsQuery.eq("store_id", storeId);
    stockQuery = stockQuery.eq("store_id", storeId);
  }

  const [{ data: alerts }, { data: recentMovements }, { data: stockRows }, { data: stores }] = await Promise.all([
    alertsQuery,
    movementsQuery,
    stockQuery,
    canFilterByStore
      ? supabase.from("stores").select("*").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] }),
  ]);

  type StockRow = { quantity: number; products: { sale_price: number } | null };
  const stock = (stockRows ?? []) as unknown as StockRow[];
  const totalStockUnits = stock.reduce((sum, r) => sum + Number(r.quantity), 0);
  const stockValue = stock.reduce((sum, r) => sum + Number(r.quantity) * Number(r.products?.sale_price ?? 0), 0);

  const selectedStoreName = storeId ? (stores ?? []).find((s) => s.id === storeId)?.name : null;

  return (
    <div className="space-y-6">
      <RealtimeStockWatcher />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vue d'ensemble du stock</h1>
          <p className="mt-1 text-sm text-slate-500">
            {selectedStoreName ?? (canFilterByStore ? "Tous les magasins" : profile.store_name)} — mise à jour en
            temps réel
          </p>
        </div>
        {canFilterByStore && <StockStoreFilter stores={stores ?? []} />}
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
              showStore={canFilterByStore}
              reversedIds={new Set()}
              canReverse={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
