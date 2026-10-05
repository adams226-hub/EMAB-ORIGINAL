import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { TransferDetail, type TransferItemRow } from "@/components/transfers/TransferDetail";

export const dynamic = "force-dynamic";

export default async function StockTransferDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: transfer } = await supabase.from("stock_transfers").select("*").eq("id", params.id).single();
  if (!transfer) notFound();

  const [{ data: items }, { data: fromStore }, { data: toStore }] = await Promise.all([
    supabase
      .from("stock_transfer_items")
      .select("product_id, quantity, products ( name, sku )")
      .eq("transfer_id", params.id),
    supabase.from("stores").select("name").eq("id", transfer.from_store_id).single(),
    supabase.from("stores").select("name").eq("id", transfer.to_store_id).single(),
  ]);

  type ItemWithProduct = {
    product_id: string;
    quantity: number;
    products: { name: string; sku: string } | null;
  };

  const rows: TransferItemRow[] = ((items ?? []) as unknown as ItemWithProduct[]).map((item) => ({
    product_id: item.product_id,
    quantity: Number(item.quantity),
    product_name: item.products?.name ?? "—",
    sku: item.products?.sku ?? "—",
  }));

  const canAct = ["super_admin", "manager", "stock_keeper"].includes(profile.role);

  return (
    <TransferDetail
      transfer={transfer}
      fromStoreName={fromStore?.name ?? "—"}
      toStoreName={toStore?.name ?? "—"}
      items={rows}
      canAct={canAct}
    />
  );
}
