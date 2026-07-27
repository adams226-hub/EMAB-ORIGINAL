"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

const WRITE_ROLES = ["super_admin", "manager", "stock_keeper"] as const;

const createCountSchema = z.object({
  store_id: z.string().uuid("Magasin requis"),
  notes: z.string().optional(),
});

export async function createStockCount(input: z.infer<typeof createCountSchema>) {
  const profile = await requireRole([...WRITE_ROLES]);
  const parsed = createCountSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (profile.role !== "super_admin" && profile.store_id !== parsed.data.store_id) {
    return { error: "Vous ne pouvez lancer un inventaire que pour votre propre magasin." };
  }

  const supabase = createClient();

  const { data: count, error } = await supabase
    .from("stock_counts")
    .insert({ store_id: parsed.data.store_id, notes: parsed.data.notes || null, created_by: profile.id })
    .select("id")
    .single();

  if (error || !count) return { error: error?.message ?? "Erreur lors de la création de l'inventaire" };

  const { data: products } = await supabase.from("products").select("id").eq("is_active", true);
  const { data: stockRows } = await supabase
    .from("product_stock")
    .select("product_id, quantity")
    .eq("store_id", parsed.data.store_id);

  const stockByProduct = new Map((stockRows ?? []).map((r) => [r.product_id, Number(r.quantity)]));

  const items = (products ?? []).map((p) => ({
    stock_count_id: count.id,
    product_id: p.id,
    expected_quantity: stockByProduct.get(p.id) ?? 0,
  }));

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("stock_count_items").insert(items);
    if (itemsError) return { error: itemsError.message };
  }

  revalidatePath("/stock/counts");
  redirect(`/stock/counts/${count.id}`);
}

export async function updateCountItem(stockCountId: string, productId: string, countedQuantity: number) {
  await requireRole([...WRITE_ROLES]);
  const supabase = createClient();
  const { error } = await supabase
    .from("stock_count_items")
    .update({ counted_quantity: countedQuantity })
    .eq("stock_count_id", stockCountId)
    .eq("product_id", productId);

  if (error) return { error: error.message };
  revalidatePath(`/stock/counts/${stockCountId}`);
  return {};
}

export async function submitStockCount(id: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_submit_stock_count", { p_count_id: id });
  if (error) return { error: error.message };
  revalidatePath(`/stock/counts/${id}`);
  revalidatePath("/stock/counts");
  return {};
}

export async function validateStockCount(id: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_validate_stock_count", { p_count_id: id });
  if (error) return { error: error.message };
  revalidatePath(`/stock/counts/${id}`);
  revalidatePath("/stock/counts");
  revalidatePath("/dashboard");
  return {};
}
