import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { CustomerReceivableDetail, type UnpaidSaleRow } from "@/components/receivables/CustomerReceivableDetail";

export const dynamic = "force-dynamic";

export default async function CustomerReceivablePage({ params }: { params: { customerId: string } }) {
  await requireRole(["super_admin", "manager", "cashier"]);
  const supabase = createClient();

  const { data: customer } = await supabase.from("customers").select("*").eq("id", params.customerId).single();
  if (!customer) notFound();

  const [{ data: sales }, { data: paymentMethods }] = await Promise.all([
    supabase
      .from("sales")
      .select("id, reference, sale_date, total_amount, amount_paid, amount_due")
      .eq("customer_id", params.customerId)
      .eq("status", "completed")
      .gt("amount_due", 0)
      .order("sale_date"),
    supabase.from("payment_methods").select("*").eq("is_active", true).order("name"),
  ]);

  const rows: UnpaidSaleRow[] = (sales ?? []).map((s) => ({
    id: s.id,
    reference: s.reference,
    sale_date: s.sale_date,
    total_amount: Number(s.total_amount),
    amount_paid: Number(s.amount_paid),
    amount_due: Number(s.amount_due),
  }));

  return (
    <div className="space-y-6">
      <Link href="/receivables" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Retour aux créances
      </Link>

      <CustomerReceivableDetail customerName={customer.name} sales={rows} paymentMethods={paymentMethods ?? []} />
    </div>
  );
}
