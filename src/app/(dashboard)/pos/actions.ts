"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

const cartItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  discount_amount: z.coerce.number().min(0).default(0),
  sale_type: z.enum(["retail", "wholesale"]).default("retail"),
});

const createSaleSchema = z.object({
  store_id: z.string().uuid("Magasin requis"),
  customer_id: z.string().uuid().optional().nullable(),
  discount_amount: z.coerce.number().min(0).default(0),
  payment_method_id: z.string().uuid().optional().nullable(),
  amount_paid: z.coerce.number().min(0),
  notes: z.string().optional(),
  walkin_name: z.string().optional(),
  walkin_phone: z.string().optional(),
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

  if (!parsed.data.customer_id && !parsed.data.walkin_name?.trim() && !parsed.data.walkin_phone?.trim()) {
    return { error: "Renseignez au moins le nom ou le téléphone du client." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_create_sale", {
    p_store_id: parsed.data.store_id,
    p_customer_id: parsed.data.customer_id || null,
    p_discount_amount: parsed.data.discount_amount,
    p_payment_method_id: parsed.data.payment_method_id || null,
    p_amount_paid: parsed.data.amount_paid,
    p_notes: parsed.data.notes || null,
    p_items: parsed.data.items,
    p_walkin_name: parsed.data.walkin_name || null,
    p_walkin_phone: parsed.data.walkin_phone || null,
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
