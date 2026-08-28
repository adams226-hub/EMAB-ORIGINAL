"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { sendPushToStoreManagers } from "@/lib/notifications/push";
import type { MovementType } from "@/types/database.types";

const WRITE_ROLES = ["super_admin", "manager", "stock_keeper"] as const;

const manualMovementLineSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive("La quantité doit être supérieure à 0"),
  unit_cost: z.coerce.number().min(0).optional(),
});

const manualMovementsBulkSchema = z.object({
  type: z.enum(["in", "out", "adjustment_in", "adjustment_out"]),
  store_id: z.string().uuid("Magasin requis"),
  reference: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(manualMovementLineSchema).min(1, "Ajoutez au moins un produit"),
});

export type ManualMovementsBulkInput = z.infer<typeof manualMovementsBulkSchema>;

export async function createManualMovementsBulk(input: ManualMovementsBulkInput) {
  const profile = await requireRole([...WRITE_ROLES]);
  const parsed = manualMovementsBulkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (profile.role !== "super_admin" && profile.store_id !== parsed.data.store_id) {
    return { error: "Vous ne pouvez enregistrer un mouvement que pour votre propre magasin." };
  }

  const supabase = createClient();
  const rows = parsed.data.items.map((item) => ({
    type: parsed.data.type,
    product_id: item.product_id,
    store_id: parsed.data.store_id,
    quantity: item.quantity,
    unit_cost: item.unit_cost ?? null,
    reference: parsed.data.reference || null,
    reason: parsed.data.reason || null,
    notes: parsed.data.notes || null,
    reference_type: "manual",
    created_by: profile.id,
  }));

  const { error } = await supabase.from("stock_movements").insert(rows);

  if (error) {
    return {
      error: error.message.includes("check constraint")
        ? "Stock insuffisant pour un des produits de cette opération."
        : error.message,
    };
  }

  revalidatePath("/stock");
  revalidatePath("/stock/movements");
  revalidatePath("/dashboard");

  if (parsed.data.type === "out" || parsed.data.type === "adjustment_out") {
    for (const item of parsed.data.items) {
      await notifyIfLowStock(supabase, item.product_id, parsed.data.store_id);
    }
  }

  return {};
}

async function notifyIfLowStock(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  storeId: string
) {
  const [{ data: stock }, { data: product }] = await Promise.all([
    supabase.from("product_stock").select("quantity, alert_threshold").eq("product_id", productId).eq("store_id", storeId).single(),
    supabase.from("products").select("name").eq("id", productId).single(),
  ]);

  if (stock && Number(stock.quantity) <= Number(stock.alert_threshold)) {
    await sendPushToStoreManagers(storeId, {
      title: "Alerte stock bas",
      body: `${product?.name ?? "Un produit"} est en dessous du seuil d'alerte (${stock.quantity} restant(s)).`,
      url: "/stock",
    });
  }
}

const REVERSIBLE_PAIRS: Partial<Record<MovementType, MovementType>> = {
  in: "out",
  out: "in",
  adjustment_in: "adjustment_out",
  adjustment_out: "adjustment_in",
};

export async function reverseMovement(movementId: string, notes?: string) {
  const profile = await requireRole([...WRITE_ROLES]);

  const supabase = createClient();
  const { data: original, error: fetchError } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("id", movementId)
    .single();

  if (fetchError || !original) return { error: "Mouvement introuvable" };
  if (original.reference_type !== "manual") {
    return { error: "Seuls les mouvements manuels (entrée/sortie/ajustement) peuvent être annulés ici." };
  }

  const oppositeType = REVERSIBLE_PAIRS[original.type];
  if (!oppositeType) return { error: "Ce type de mouvement ne peut pas être annulé directement." };

  if (profile.role !== "super_admin" && profile.store_id !== original.store_id) {
    return { error: "Vous ne pouvez annuler que les mouvements de votre magasin." };
  }

  const { data: existingReversal } = await supabase
    .from("stock_movements")
    .select("id")
    .eq("reversal_of", movementId)
    .maybeSingle();

  if (existingReversal) return { error: "Ce mouvement a déjà été annulé." };

  const { error } = await supabase.from("stock_movements").insert({
    type: oppositeType,
    product_id: original.product_id,
    store_id: original.store_id,
    quantity: original.quantity,
    reference_type: "manual",
    reversal_of: movementId,
    notes: notes || `Annulation du mouvement du ${new Date(original.created_at).toLocaleDateString("fr-FR")}`,
    created_by: profile.id,
  });

  if (error) {
    return {
      error: error.message.includes("check constraint")
        ? "Impossible d'annuler : le stock résultant serait négatif."
        : error.message,
    };
  }

  revalidatePath("/stock");
  revalidatePath("/stock/movements");
  revalidatePath("/dashboard");
  return {};
}
