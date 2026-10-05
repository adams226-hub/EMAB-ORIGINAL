"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { hasAllStoresScopeForStock } from "@/lib/auth/permissions";

const WRITE_ROLES = ["super_admin", "manager", "stock_keeper"] as const;

const transferItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive("La quantité doit être supérieure à 0"),
});

const createTransferSchema = z.object({
  from_store_id: z.string().uuid("Magasin source requis"),
  to_store_id: z.string().uuid("Magasin destinataire requis"),
  notes: z.string().optional(),
  items: z.array(transferItemSchema).min(1, "Ajoutez au moins un produit"),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export async function createStockTransfer(input: CreateTransferInput) {
  const profile = await requireRole([...WRITE_ROLES]);
  const parsed = createTransferSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (parsed.data.from_store_id === parsed.data.to_store_id) {
    return { error: "Le magasin source et le magasin destinataire doivent être différents." };
  }

  if (!hasAllStoresScopeForStock(profile.role) && profile.store_id !== parsed.data.from_store_id) {
    return { error: "Vous ne pouvez lancer un transfert que depuis votre propre magasin." };
  }

  const supabase = createClient();

  const { data: transfer, error } = await supabase
    .from("stock_transfers")
    .insert({
      from_store_id: parsed.data.from_store_id,
      to_store_id: parsed.data.to_store_id,
      notes: parsed.data.notes || null,
      requested_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !transfer) return { error: error?.message ?? "Erreur lors de la création du transfert" };

  const rows = parsed.data.items.map((item) => ({
    transfer_id: transfer.id,
    product_id: item.product_id,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase.from("stock_transfer_items").insert(rows);
  if (itemsError) return { error: itemsError.message };

  revalidatePath("/stock/transfers");
  redirect(`/stock/transfers/${transfer.id}`);
}

export async function validateTransfer(id: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_validate_transfer", { p_transfer_id: id });
  if (error) return { error: error.message };
  revalidatePath(`/stock/transfers/${id}`);
  revalidatePath("/stock/transfers");
  return {};
}

export async function receiveTransfer(id: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_receive_transfer", { p_transfer_id: id });
  if (error) return { error: error.message };
  revalidatePath(`/stock/transfers/${id}`);
  revalidatePath("/stock/transfers");
  revalidatePath("/stock");
  return {};
}

export async function cancelTransfer(id: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_cancel_transfer", { p_transfer_id: id });
  if (error) return { error: error.message };
  revalidatePath(`/stock/transfers/${id}`);
  revalidatePath("/stock/transfers");
  return {};
}
