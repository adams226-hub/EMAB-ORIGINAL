import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { SaleDetail, type SaleItemRow, type SalePaymentRow } from "@/components/sales/SaleDetail";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: sale } = await supabase.from("v_sales_detail").select("*").eq("id", params.id).single();
  if (!sale) notFound();

  const [{ data: items }, { data: payments }, { data: paymentMethods }] = await Promise.all([
    supabase.from("sale_items").select("id, quantity, unit_price, discount_amount, line_total, products ( name, sku )").eq("sale_id", params.id),
    supabase
      .from("payments")
      .select("id, amount, payment_date, payment_methods ( name ), profiles ( full_name )")
      .eq("type", "sale_payment")
      .eq("reference_id", params.id)
      .order("payment_date"),
    supabase.from("payment_methods").select("*").eq("is_active", true).order("name"),
  ]);

  type ItemWithProduct = {
    id: string;
    quantity: number;
    unit_price: number;
    discount_amount: number;
    line_total: number;
    products: { name: string; sku: string } | null;
  };

  type PaymentWithRelations = {
    id: string;
    amount: number;
    payment_date: string;
    payment_methods: { name: string } | null;
    profiles: { full_name: string } | null;
  };

  const itemRows: SaleItemRow[] = ((items ?? []) as unknown as ItemWithProduct[]).map((item) => ({
    id: item.id,
    product_name: item.products?.name ?? "—",
    sku: item.products?.sku ?? "—",
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    discount_amount: Number(item.discount_amount),
    line_total: Number(item.line_total),
  }));

  const paymentRows: SalePaymentRow[] = ((payments ?? []) as unknown as PaymentWithRelations[]).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    payment_method_name: p.payment_methods?.name ?? "—",
    payment_date: p.payment_date,
    paid_by_name: p.profiles?.full_name ?? null,
  }));

  const isSuperAdmin = profile.role === "super_admin";
  const atStore = profile.store_id === sale.store_id;
  const canCancel = isSuperAdmin || (profile.role === "manager" && atStore);
  const canRecordPayment = isSuperAdmin || (["manager", "cashier"].includes(profile.role) && atStore);

  return (
    <div className="space-y-6">
      <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Retour aux ventes
      </Link>

      <SaleDetail
        sale={sale}
        items={itemRows}
        payments={paymentRows}
        paymentMethods={paymentMethods ?? []}
        canCancel={canCancel}
        canRecordPayment={canRecordPayment}
      />
    </div>
  );
}
