import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ExpensesManager, type ExpenseRow } from "@/components/expenses/ExpensesManager";
import type { Store, ExpenseCategory, PaymentMethod, Expense } from "@/types/database.types";

export const dynamic = "force-dynamic";

type ExpenseWithRelations = Expense & {
  stores: { name: string } | null;
  expense_categories: { name: string } | null;
  payment_methods: { name: string } | null;
};

export default async function ExpensesPage() {
  const profile = await requireRole(["super_admin", "manager"]);
  const supabase = createClient();

  let expensesQuery = supabase
    .from("expenses")
    .select("*, stores ( name ), expense_categories ( name ), payment_methods ( name )")
    .order("expense_date", { ascending: false })
    .limit(200);

  if (profile.role !== "super_admin" && profile.store_id) {
    expensesQuery = expensesQuery.eq("store_id", profile.store_id);
  }

  const [{ data: expenses }, { data: categories }, { data: paymentMethods }, { data: stores }] = await Promise.all([
    expensesQuery,
    supabase.from("expense_categories").select("*").eq("is_active", true).order("name"),
    supabase.from("payment_methods").select("*").eq("is_active", true).order("name"),
    profile.role === "super_admin" ? supabase.from("stores").select("*").eq("is_active", true).order("name") : Promise.resolve({ data: [] }),
  ]);

  const rows: ExpenseRow[] = ((expenses ?? []) as unknown as ExpenseWithRelations[]).map((e) => ({
    id: e.id,
    store_name: e.stores?.name ?? "—",
    category_name: e.expense_categories?.name ?? null,
    payment_method_name: e.payment_methods?.name ?? "—",
    amount: Number(e.amount),
    description: e.description,
    expense_date: e.expense_date,
  }));

  return (
    <ExpensesManager
      expenses={rows}
      categories={categories ?? []}
      paymentMethods={paymentMethods ?? []}
      stores={stores ?? []}
      fixedStoreId={profile.role === "super_admin" ? null : profile.store_id}
      canDelete={profile.role === "super_admin"}
    />
  );
}
