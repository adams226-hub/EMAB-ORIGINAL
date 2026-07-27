import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { toXlsx, xlsxResponse } from "@/lib/xlsx";
import type { Expense } from "@/types/database.types";

type ExpenseWithRelations = Expense & {
  stores: { name: string } | null;
  expense_categories: { name: string } | null;
  payment_methods: { name: string } | null;
};

export async function GET(request: NextRequest) {
  const profile = await requireRole(["super_admin", "manager"]);
  const supabase = createClient();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const storeId = searchParams.get("store_id");

  let query = supabase
    .from("expenses")
    .select("*, stores ( name ), expense_categories ( name ), payment_methods ( name )")
    .order("expense_date", { ascending: false });

  if (profile.role !== "super_admin" && profile.store_id) {
    query = query.eq("store_id", profile.store_id);
  } else if (storeId) {
    query = query.eq("store_id", storeId);
  }
  if (from) query = query.gte("expense_date", from);
  if (to) query = query.lte("expense_date", to);

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 400 });

  const rows = ((data ?? []) as unknown as ExpenseWithRelations[]).map((e) => ({
    expense_date: e.expense_date,
    store_name: e.stores?.name ?? "",
    category_name: e.expense_categories?.name ?? "",
    payment_method_name: e.payment_methods?.name ?? "",
    description: e.description,
    amount: e.amount,
  }));

  const xlsx = toXlsx(
    rows,
    [
      { key: "expense_date", label: "Date" },
      { key: "store_name", label: "Magasin" },
      { key: "category_name", label: "Catégorie" },
      { key: "payment_method_name", label: "Mode de paiement" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Montant" },
    ],
    "Dépenses"
  );

  return xlsxResponse(xlsx, `depenses_${from ?? "debut"}_${to ?? "fin"}.xlsx`);
}
