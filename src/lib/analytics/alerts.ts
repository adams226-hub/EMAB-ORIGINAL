import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type AlertSeverity = "warning" | "critical";

export interface AnalyticalAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  href: string;
}

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * Alertes analytiques : au-delà des seuils statiques (stock bas, déjà
 * couvert en Phase 2), ces alertes comparent la donnée à son propre
 * historique pour détecter un signal qui mérite l'attention d'un gérant.
 */
export async function getAnalyticalAlerts(
  supabase: SupabaseClient<Database>,
  { storeId }: { storeId: string | null }
): Promise<AnalyticalAlert[]> {
  const alerts: AnalyticalAlert[] = [];

  // 1. Baisse de chiffre d'affaires : 7 derniers jours vs 7 jours précédents
  {
    let recentQuery = supabase
      .from("sales")
      .select("total_amount")
      .eq("status", "completed")
      .gte("sale_date", daysAgoISO(7));
    let priorQuery = supabase
      .from("sales")
      .select("total_amount")
      .eq("status", "completed")
      .gte("sale_date", daysAgoISO(14))
      .lt("sale_date", daysAgoISO(7));

    if (storeId) {
      recentQuery = recentQuery.eq("store_id", storeId);
      priorQuery = priorQuery.eq("store_id", storeId);
    }

    const [{ data: recent }, { data: prior }] = await Promise.all([recentQuery, priorQuery]);
    const recentTotal = (recent ?? []).reduce((s, r) => s + Number(r.total_amount), 0);
    const priorTotal = (prior ?? []).reduce((s, r) => s + Number(r.total_amount), 0);

    if (priorTotal > 0) {
      const change = ((recentTotal - priorTotal) / priorTotal) * 100;
      if (change <= -20) {
        alerts.push({
          id: "revenue-drop",
          severity: change <= -40 ? "critical" : "warning",
          title: "Baisse du chiffre d'affaires",
          description: `Ventes en baisse de ${Math.abs(Math.round(change))}% sur 7 jours par rapport à la semaine précédente.`,
          href: "/analytics/sales",
        });
      }
    }
  }

  // 2. Créances en retard (> 30 jours)
  {
    let query = supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gt("amount_due", 0)
      .lt("sale_date", daysAgoISO(30));
    if (storeId) query = query.eq("store_id", storeId);

    const { count } = await query;
    if (count && count > 0) {
      alerts.push({
        id: "overdue-receivables",
        severity: count >= 5 ? "critical" : "warning",
        title: "Créances en retard",
        description: `${count} vente(s) impayée(s) depuis plus de 30 jours.`,
        href: "/receivables",
      });
    }
  }

  // 3. Stock dormant : produits en stock sans aucune vente depuis 60 jours
  {
    let stockQuery = supabase.from("product_stock").select("product_id, quantity, store_id").gt("quantity", 0);
    if (storeId) stockQuery = stockQuery.eq("store_id", storeId);

    const { data: stockRows } = await stockQuery;
    const productIds = Array.from(new Set((stockRows ?? []).map((r) => r.product_id)));

    if (productIds.length > 0) {
      let recentSaleIdsQuery = supabase
        .from("sales")
        .select("id")
        .eq("status", "completed")
        .gte("sale_date", daysAgoISO(60));
      if (storeId) recentSaleIdsQuery = recentSaleIdsQuery.eq("store_id", storeId);

      const { data: recentSaleIds } = await recentSaleIdsQuery;
      const saleIds = (recentSaleIds ?? []).map((s) => s.id);

      const { data: recentSales } = saleIds.length
        ? await supabase.from("sale_items").select("product_id").in("product_id", productIds).in("sale_id", saleIds)
        : { data: [] };

      const soldRecently = new Set((recentSales ?? []).map((r) => r.product_id));
      const deadStockCount = productIds.filter((id) => !soldRecently.has(id)).length;

      if (deadStockCount > 0) {
        alerts.push({
          id: "dead-stock",
          severity: deadStockCount >= 10 ? "critical" : "warning",
          title: "Produits dormants",
          description: `${deadStockCount} produit(s) en stock n'ont été vendus depuis au moins 60 jours.`,
          href: "/stock",
        });
      }
    }
  }

  return alerts;
}
