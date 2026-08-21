"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

const unitSchema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  abbreviation: z.string().min(1, "L'abréviation est requise"),
});

export type UnitInput = z.infer<typeof unitSchema>;

const WRITE_ROLES = ["super_admin", "manager"] as const;

export async function createUnit(input: UnitInput) {
  await requireRole([...WRITE_ROLES]);
  const parsed = unitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { error } = await supabase.from("units").insert(parsed.data);
  if (error) return { error: error.message.includes("duplicate") ? "Cette unité existe déjà" : error.message };

  revalidatePath("/units");
  revalidatePath("/catalog");
  return {};
}

export async function updateUnit(id: string, input: UnitInput) {
  await requireRole([...WRITE_ROLES]);
  const parsed = unitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { error } = await supabase.from("units").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/units");
  revalidatePath("/catalog");
  return {};
}

export async function deleteUnit(id: string) {
  await requireRole(["super_admin"]);
  const supabase = createClient();
  const { error } = await supabase.from("units").delete().eq("id", id);
  if (error) {
    return {
      error: error.message.includes("foreign key")
        ? "Impossible de supprimer : des produits utilisent cette unité."
        : error.message,
    };
  }
  revalidatePath("/units");
  revalidatePath("/catalog");
  return {};
}
