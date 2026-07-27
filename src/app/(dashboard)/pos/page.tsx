import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { POSTerminal, type POSProduct } from "@/components/pos/POSTerminal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function POSPage({ searchParams }: { searchParams: { store?: string } }) {
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
              href={`/pos?store=${store.id}`}
              className="block rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50"
            >
              {store.name}
            </Link>
          ))}
        </CardContent>
      </Card>
    );
  }

  const [{ data: products }, { data: stockRows }, { data: customers }, { data: paymentMethods }] = await Promise.all([
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    supabase.from("product_stock").select("product_id, quantity").eq("store_id", storeId),
    supabase.from("customers").select("*").eq("is_active", true).order("name"),
    supabase.from("payment_methods").select("*").eq("is_active", true).order("name"),
  ]);

  const stockByProduct = new Map((stockRows ?? []).map((r) => [r.product_id, Number(r.quantity)]));

  const posProducts: POSProduct[] = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    sale_price: p.sale_price,
    unit: p.unit,
    stock_quantity: stockByProduct.get(p.id) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Point de vente</h1>
        <p className="mt-1 text-sm text-slate-500">{profile.store_name ?? "Sélectionnez un produit pour commencer"}</p>
      </div>

      <POSTerminal
        storeId={storeId}
        products={posProducts}
        customers={customers ?? []}
        paymentMethods={paymentMethods ?? []}
      />
    </div>
  );
}
