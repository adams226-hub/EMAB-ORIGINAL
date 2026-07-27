import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import { StockTable, type StoreStockRow } from "@/components/products/StockTable";
import type { Product, Store } from "@/types/database.types";

export const dynamic = "force-dynamic";

type ProductWithCategory = Product & { categories: { name: string } | null };

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*, categories ( name )")
    .eq("id", params.id)
    .single();

  if (!product) notFound();

  const { categories: category, ...productData } = product as unknown as ProductWithCategory;

  const [{ data: stores }, { data: stockRows }] = await Promise.all([
    supabase.from("stores").select("*").order("name"),
    supabase.from("product_stock").select("store_id, quantity, alert_threshold").eq("product_id", params.id),
  ]);

  const stockByStore = new Map(
    (stockRows ?? []).map((r) => [r.store_id, { quantity: Number(r.quantity), alert_threshold: Number(r.alert_threshold) }])
  );

  const rows: StoreStockRow[] = (stores as Store[] ?? [])
    .filter((store) => profile.role === "super_admin" || store.id === profile.store_id)
    .map((store) => ({
      store,
      quantity: stockByStore.get(store.id)?.quantity ?? 0,
      alert_threshold: stockByStore.get(store.id)?.alert_threshold ?? 5,
      editable: profile.role === "super_admin" || store.id === profile.store_id,
    }));

  return (
    <div className="space-y-6">
      <Link href="/products" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Retour aux produits
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{productData.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            SKU {productData.sku}
            {productData.barcode ? ` · Code-barre ${productData.barcode}` : ""}
          </p>
        </div>
        <Badge tone={productData.is_active ? "success" : "default"}>
          {productData.is_active ? "Actif" : "Inactif"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Informations produit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Catégorie</span>
              <span className="font-medium text-slate-900">{category?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Unité</span>
              <span className="font-medium text-slate-900">{productData.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Prix d'achat</span>
              <span className="font-medium text-slate-900">{formatCurrency(productData.purchase_price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Prix de vente</span>
              <span className="font-medium text-slate-900">{formatCurrency(productData.sale_price)}</span>
            </div>
            {productData.description && (
              <p className="border-t border-slate-100 pt-3 text-slate-600">{productData.description}</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Stock par magasin</CardTitle>
          </CardHeader>
          <CardContent>
            <StockTable productId={params.id} rows={rows} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
