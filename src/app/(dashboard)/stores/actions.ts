"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

const storeSchema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  code: z.string().min(2, "Le code est requis").toUpperCase(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().or(z.literal("")).nullable(),
});

export type StoreInput = z.infer<typeof storeSchema>;

export async function createStore(input: StoreInput) {
  const requester = await requireRole(["super_admin"]);
  const parsed = storeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const [{ count: storeCount }, { data: tenant }] = await Promise.all([
    supabase.from("stores").select("id", { count: "exact", head: true }),
    supabase.from("tenants").select("max_stores").eq("id", requester.tenant_id).single(),
  ]);

  if (tenant && (storeCount ?? 0) >= tenant.max_stores) {
    return {
      error: `Limite de votre abonnement atteinte (${tenant.max_stores} magasins). Passez à un plan supérieur pour en ajouter.`,
    };
  }

  const { error } = await supabase.from("stores").insert(parsed.data);
  if (error) return { error: error.message.includes("duplicate") ? "Ce code magasin existe déjà" : error.message };

  revalidatePath("/stores");
  revalidatePath("/administration");
  revalidatePath("/dashboard");
  return {};
}

export async function updateStore(id: string, input: StoreInput) {
  await requireRole(["super_admin"]);
  const parsed = storeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { error } = await supabase.from("stores").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/stores");
  revalidatePath("/administration");
  return {};
}

export async function toggleStoreActive(id: string, isActive: boolean) {
  await requireRole(["super_admin"]);
  const supabase = createClient();
  const { error } = await supabase.from("stores").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/stores");
  revalidatePath("/administration");
  return {};
}

export async function deleteStore(id: string) {
  await requireRole(["super_admin"]);
  const supabase = createClient();
  const { error } = await supabase.from("stores").delete().eq("id", id);
  if (error) {
    return {
      error: error.message.includes("foreign key")
        ? "Impossible de supprimer : ce magasin contient des données liées (stock, utilisateurs)."
        : error.message,
    };
  }

  revalidatePath("/stores");
  revalidatePath("/administration");
  revalidatePath("/dashboard");
  return {};
}
