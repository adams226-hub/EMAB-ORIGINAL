"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireRole } from "@/lib/auth/session";

const productSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  sku: z.string().min(1, "La référence (SKU) est requise"),
  category_id: z.string().uuid().optional().nullable().or(z.literal("")),
  unit: z.string().min(1).default("pièce"),
  purchase_price: z.coerce.number().min(0),
  sale_price: z.coerce.number().min(0),
  wholesale_price: z.coerce.number().min(0).optional().nullable(),
  receipt_code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  initial_quantity: z.coerce.number().min(0).optional(),
  initial_stocks: z.array(z.object({ store_id: z.string().uuid(), quantity: z.coerce.number().min(0) })).optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

const WRITE_ROLES = ["super_admin", "manager", "stock_keeper"] as const;

export async function createProduct(input: ProductInput) {
  const profile = await requireRole([...WRITE_ROLES]);
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name: parsed.data.name,
      sku: parsed.data.sku,
      category_id: parsed.data.category_id || null,
      unit: parsed.data.unit,
      purchase_price: parsed.data.purchase_price,
      sale_price: parsed.data.sale_price,
      wholesale_price: parsed.data.wholesale_price || null,
      receipt_code: parsed.data.receipt_code || null,
      description: parsed.data.description || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message.includes("duplicate") ? "Ce SKU existe déjà" : error.message };

  if (profile.store_id && parsed.data.initial_quantity && parsed.data.initial_quantity > 0) {
    await supabase.from("product_stock").insert({
      product_id: product.id,
      store_id: profile.store_id,
      quantity: parsed.data.initial_quantity,
    });
  } else if (parsed.data.initial_stocks?.length) {
    const rows = parsed.data.initial_stocks
      .filter((s) => s.quantity > 0)
      .map((s) => ({ product_id: product.id, store_id: s.store_id, quantity: s.quantity }));
    if (rows.length > 0) await supabase.from("product_stock").insert(rows);
  }

  revalidatePath("/products");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");
  return {};
}

export async function updateProduct(id: string, input: ProductInput) {
  await requireRole([...WRITE_ROLES]);
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      sku: parsed.data.sku,
      category_id: parsed.data.category_id || null,
      unit: parsed.data.unit,
      purchase_price: parsed.data.purchase_price,
      sale_price: parsed.data.sale_price,
      wholesale_price: parsed.data.wholesale_price || null,
      receipt_code: parsed.data.receipt_code || null,
      description: parsed.data.description || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/products");
  revalidatePath("/catalog");
  return {};
}

export async function toggleProductActive(id: string, isActive: boolean) {
  await requireRole([...WRITE_ROLES]);
  const supabase = createClient();
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/products");
  revalidatePath("/catalog");
  return {};
}

export async function deleteProduct(id: string) {
  await requireRole(["super_admin"]);
  const supabase = createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    return {
      error: error.message.includes("foreign key constraint")
        ? "Ce produit a déjà des mouvements de stock ou des ventes enregistrées : il ne peut pas être supprimé. Désactivez-le plutôt (bouton Actif/Inactif)."
        : error.message,
    };
  }
  revalidatePath("/products");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");
  return {};
}

const stockSchema = z.object({
  store_id: z.string().uuid(),
  quantity: z.coerce.number().min(0),
  alert_threshold: z.coerce.number().min(0),
});

export async function upsertProductStock(productId: string, input: z.infer<typeof stockSchema>) {
  const profile = await requireRole([...WRITE_ROLES]);
  const parsed = stockSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (profile.role !== "super_admin" && profile.store_id !== parsed.data.store_id) {
    return { error: "Vous ne pouvez modifier le stock que de votre propre magasin." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("product_stock")
    .upsert(
      {
        product_id: productId,
        store_id: parsed.data.store_id,
        quantity: parsed.data.quantity,
        alert_threshold: parsed.data.alert_threshold,
      },
      { onConflict: "product_id,store_id" }
    );

  if (error) return { error: error.message };

  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard");
  return {};
}
