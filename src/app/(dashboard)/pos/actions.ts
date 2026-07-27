"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

const cartItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
});

const createSaleSchema = z.object({
  store_id: z.string().uuid("Magasin requis"),
  customer_id: z.string().uuid().optional().nullable(),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
  payment_method_id: z.string().uuid().optional().nullable(),
  amount_paid: z.coerce.number().min(0),
  notes: z.string().optional(),
  items: z.array(cartItemSchema).min(1, "Le panier est vide"),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export async function createSale(input: CreateSaleInput) {
  await requireRole(["super_admin", "manager", "cashier"]);
  const parsed = createSaleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (parsed.data.amount_paid > 0 && !parsed.data.payment_method_id) {
    return { error: "Sélectionnez un mode de paiement" };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_create_sale", {
    p_store_id: parsed.data.store_id,
    p_customer_id: parsed.data.customer_id || null,
    p_discount_percent: parsed.data.discount_percent,
    p_payment_method_id: parsed.data.payment_method_id || null,
    p_amount_paid: parsed.data.amount_paid,
    p_notes: parsed.data.notes || null,
    p_items: parsed.data.items,
  });

  if (error) {
    return {
      error: error.message.includes("check constraint")
        ? "Stock insuffisant pour un des produits du panier."
        : error.message,
    };
  }

  return { saleId: data.id as string };
}
