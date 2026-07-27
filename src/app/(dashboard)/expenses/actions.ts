"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

const WRITE_ROLES = ["super_admin", "manager"] as const;

const expenseSchema = z.object({
  store_id: z.string().uuid("Magasin requis"),
  category_id: z.string().uuid().optional().or(z.literal("")),
  payment_method_id: z.string().uuid("Mode de paiement requis"),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  description: z.string().min(2, "La description est requise"),
  expense_date: z.string().optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export async function createExpense(input: ExpenseInput) {
  const profile = await requireRole([...WRITE_ROLES]);
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (profile.role !== "super_admin" && profile.store_id !== parsed.data.store_id) {
    return { error: "Vous ne pouvez enregistrer une dépense que pour votre propre magasin." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("expenses").insert({
    store_id: parsed.data.store_id,
    category_id: parsed.data.category_id || null,
    payment_method_id: parsed.data.payment_method_id,
    amount: parsed.data.amount,
    description: parsed.data.description,
    expense_date: parsed.data.expense_date || new Date().toISOString().slice(0, 10),
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/expenses");
  revalidatePath("/finance");
  return {};
}

export async function deleteExpense(id: string) {
  await requireRole(["super_admin"]);
  const supabase = createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/finance");
  return {};
}

const categorySchema = z.object({ name: z.string().min(2, "Le nom est requis") });

export async function createExpenseCategory(name: string) {
  await requireRole([...WRITE_ROLES]);
  const parsed = categorySchema.safeParse({ name });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { error } = await supabase.from("expense_categories").insert(parsed.data);
  if (error) return { error: error.message.includes("duplicate") ? "Cette catégorie existe déjà" : error.message };

  revalidatePath("/expenses");
  return {};
}

export async function deleteExpenseCategory(id: string) {
  await requireRole(["super_admin"]);
  const supabase = createClient();
  const { error } = await supabase.from("expense_categories").delete().eq("id", id);
  if (error) {
    return {
      error: error.message.includes("foreign key")
        ? "Impossible de supprimer : des dépenses utilisent cette catégorie."
        : error.message,
    };
  }
  revalidatePath("/expenses");
  return {};
}
