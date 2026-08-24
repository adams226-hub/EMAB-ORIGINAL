import { Fragment } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { PrintButton } from "@/components/sales/PrintButton";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SaleReceiptPage({ params }: { params: { id: string } }) {
  await getCurrentProfile();
  const supabase = createClient();

  const { data: sale } = await supabase.from("v_sales_detail").select("*").eq("id", params.id).single();
  if (!sale) notFound();

  const { data: items } = await supabase
    .from("sale_items")
    .select("quantity, unit_price, discount_percent, line_total, products ( name, sku, receipt_code )")
    .eq("sale_id", params.id);

  const { data: store } = await supabase.from("stores").select("*").eq("id", sale.store_id).single();

  type ItemWithProduct = {
    quantity: number;
    unit_price: number;
    discount_percent: number;
    line_total: number;
    products: { name: string; sku: string; receipt_code: string | null } | null;
  };

  const rows = ((items ?? []) as unknown as ItemWithProduct[]).map((item, index) => ({
    id: index,
    name: item.products?.receipt_code || item.products?.name || "—",
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    line_total: Number(item.line_total),
  }));

  return (
    <div className="mx-auto min-h-screen max-w-sm bg-slate-100 px-4 py-8 print:bg-white print:py-0">
      <div className="mb-4 flex justify-center print:hidden">
        <PrintButton />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 font-mono text-sm text-slate-800 shadow-card print:rounded-none print:border-0 print:shadow-none">
        <div className="text-center">
          <p className="text-base font-bold">{store?.name ?? "EMAB"}</p>
          {store?.address && <p>{store.address}</p>}
          {store?.phone && <p>{store.phone}</p>}
        </div>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <div className="space-y-0.5">
          <p>Reçu : {sale.reference}</p>
          <p>Date : {formatDate(sale.sale_date)}</p>
          <p>Client : {sale.customer_name ?? "Client de passage"}</p>
          {sale.customer_phone && <p>Téléphone : {sale.customer_phone}</p>}
          {sale.sold_by_name && <p>Servi par : {sale.sold_by_name}</p>}
        </div>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <table className="w-full">
          <tbody>
            {rows.map((item) => (
              <Fragment key={item.id}>
                <tr>
                  <td colSpan={3}>{item.name}</td>
                </tr>
                <tr>
                  <td>
                    {item.quantity} x {formatCurrency(item.unit_price)}
                  </td>
                  <td />
                  <td className="text-right">{formatCurrency(item.line_total)}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>Sous-total</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discount_percent > 0 && (
            <div className="flex justify-between">
              <span>Remise</span>
              <span>{sale.discount_percent}%</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <span>TOTAL</span>
            <span>{formatCurrency(sale.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Payé</span>
            <span>{formatCurrency(sale.amount_paid)}</span>
          </div>
          {sale.amount_due > 0 && (
            <div className="flex justify-between font-bold">
              <span>Solde dû</span>
              <span>{formatCurrency(sale.amount_due)}</span>
            </div>
          )}
        </div>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <p className="text-center text-xs">Merci pour votre confiance !</p>
      </div>
    </div>
  );
}
