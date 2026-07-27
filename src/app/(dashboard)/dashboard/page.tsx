import { Store, Package, Tags, Users, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { canAccessModule } from "@/lib/auth/permissions";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const [storesCount, productsCount, categoriesCount, usersCount, overview] = await Promise.all([
    supabase.from("stores").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("categories").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("v_products_overview").select("total_stock, stores_low_stock, sale_price"),
  ]);

  const rows = overview.data ?? [];
  const totalStockUnits = rows.reduce((sum, r) => sum + Number(r.total_stock), 0);
  const stockValue = rows.reduce((sum, r) => sum + Number(r.total_stock) * Number(r.sale_price), 0);
  const lowStockProducts = rows.filter((r) => r.stores_low_stock > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Bonjour, {profile.full_name.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Voici un aperçu de {profile.store_name ?? "l'ensemble du réseau"}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canAccessModule(profile.role, "stores") && (
          <StatCard label="Magasins" value={String(storesCount.count ?? 0)} icon={Store} />
        )}
        <StatCard label="Produits actifs" value={String(productsCount.count ?? 0)} icon={Package} />
        <StatCard label="Catégories" value={String(categoriesCount.count ?? 0)} icon={Tags} />
        {canAccessModule(profile.role, "users") && (
          <StatCard label="Utilisateurs" value={String(usersCount.count ?? 0)} icon={Users} />
        )}
        <StatCard
          label="Unités en stock"
          value={totalStockUnits.toLocaleString("fr-FR")}
          icon={Package}
          tone="success"
        />
        <StatCard
          label="Valeur du stock"
          value={formatCurrency(stockValue)}
          icon={Package}
          tone="success"
          hint="Basée sur le prix de vente"
        />
        <StatCard
          label="Alertes stock bas"
          value={String(lowStockProducts)}
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Modules disponibles pour votre rôle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              L'accès aux modules (Magasins, Utilisateurs, Produits, Catégories) est déterminé
              automatiquement par votre rôle et, le cas échéant, restreint à votre magasin grâce
              aux règles de sécurité (Row Level Security) définies côté base de données.
            </p>
            <p>
              Ce tableau de bord évoluera en Phase 2 avec les ventes, dépenses, bénéfices,
              créances et rapports détaillés.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prochaines étapes (Phase 2)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>• Mouvements de stock (entrées, sorties, transferts inter-magasins)</li>
              <li>• Module de ventes et point de vente (POS)</li>
              <li>• Gestion des dépenses et des créances clients</li>
              <li>• Rapports et export (PDF / Excel)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
