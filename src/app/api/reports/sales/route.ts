import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { toXlsx, xlsxResponse } from "@/lib/xlsx";

export async function GET(request: NextRequest) {
  const profile = await requireRole(["super_admin", "manager"]);
  const supabase = createClient();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const storeId = searchParams.get("store_id");

  let query = supabase
    .from("v_sales_detail")
    .select("*")
    .order("sale_date", { ascending: false });

  if (profile.role !== "super_admin" && profile.store_id) {
    query = query.eq("store_id", profile.store_id);
  } else if (storeId) {
    query = query.eq("store_id", storeId);
  }
  if (from) query = query.gte("sale_date", `${from}T00:00:00`);
  if (to) query = query.lte("sale_date", `${to}T23:59:59`);

  const { data: sales, error } = await query;
  if (error) return new Response(error.message, { status: 400 });

  const saleIds = (sales ?? []).map((s) => s.id);
  const { data: payments } = saleIds.length
    ? await supabase
        .from("payments")
        .select("reference_id, amount, payment_methods ( name )")
        .eq("type", "sale_payment")
        .in("reference_id", saleIds)
    : { data: [] };

  type SalePaymentRow = { reference_id: string; amount: number; payment_methods: { name: string } | null };
  const mobileMoneyBySale = new Map<string, number>();
  const cashBySale = new Map<string, number>();

  for (const p of (payments ?? []) as unknown as SalePaymentRow[]) {
    const methodName = p.payment_methods?.name;
    const bucket = methodName === "Mobile Money" ? mobileMoneyBySale : methodName === "Espèces" ? cashBySale : null;
    if (!bucket) continue;
    bucket.set(p.reference_id, (bucket.get(p.reference_id) ?? 0) + Number(p.amount));
  }

  const rows = (sales ?? []).map((s) => ({
    ...s,
    mobile_money_amount: mobileMoneyBySale.get(s.id) ?? 0,
    cash_amount: cashBySale.get(s.id) ?? 0,
  }));

  const xlsx = toXlsx(
    rows,
    [
      { key: "reference", label: "Référence" },
      { key: "sale_date", label: "Date" },
      { key: "store_name", label: "Magasin" },
      { key: "customer_name", label: "Client" },
      { key: "subtotal", label: "Sous-total" },
      { key: "mobile_money_amount", label: "Mobile Money" },
      { key: "cash_amount", label: "Espèces" },
      { key: "discount_percent", label: "Remise (%)" },
      { key: "total_amount", label: "Total" },
      { key: "amount_paid", label: "Payé" },
      { key: "amount_due", label: "Solde dû" },
      { key: "payment_status", label: "Statut" },
    ],
    "Ventes"
  );

  return xlsxResponse(xlsx, `ventes_${from ?? "debut"}_${to ?? "fin"}.xlsx`);
}
