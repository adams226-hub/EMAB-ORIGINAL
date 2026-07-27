import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { CountDetail, type CountItemRow } from "@/components/counts/CountDetail";

export const dynamic = "force-dynamic";

export default async function StockCountDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: count } = await supabase.from("stock_counts").select("*").eq("id", params.id).single();
  if (!count) notFound();

  const [{ data: items }, { data: store }] = await Promise.all([
    supabase
      .from("stock_count_items")
      .select("product_id, expected_quantity, counted_quantity, products ( name, sku )")
      .eq("stock_count_id", params.id),
    supabase.from("stores").select("name").eq("id", count.store_id).single(),
  ]);

  type ItemWithProduct = {
    product_id: string;
    expected_quantity: number;
    counted_quantity: number | null;
    products: { name: string; sku: string } | null;
  };

  const rows: CountItemRow[] = ((items ?? []) as unknown as ItemWithProduct[]).map((item) => ({
    product_id: item.product_id,
    expected_quantity: Number(item.expected_quantity),
    counted_quantity: item.counted_quantity === null ? null : Number(item.counted_quantity),
    product_name: item.products?.name ?? "—",
    sku: item.products?.sku ?? "—",
  }));

  const isSuperAdmin = profile.role === "super_admin";
  const atStore = profile.store_id === count.store_id;

  const canEdit = count.status === "draft" && (isSuperAdmin || atStore);
  const canSubmit = canEdit;
  const canValidate =
    count.status === "submitted" && (isSuperAdmin || (profile.role === "manager" && atStore));

  return (
    <div className="space-y-6">
      <Link href="/stock/counts" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Retour aux inventaires
      </Link>

      <CountDetail
        count={count}
        storeName={store?.name ?? "—"}
        items={rows}
        canEdit={canEdit}
        canSubmit={canSubmit}
        canValidate={canValidate}
      />
    </div>
  );
}
