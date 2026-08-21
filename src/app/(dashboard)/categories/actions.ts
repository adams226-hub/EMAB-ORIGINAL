"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { slugify } from "@/lib/utils";

const categorySchema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  description: z.string().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable().or(z.literal("")),
});

export type CategoryInput = z.infer<typeof categorySchema>;

const WRITE_ROLES = ["super_admin", "manager"] as const;

export async function createCategory(input: CategoryInput) {
  await requireRole([...WRITE_ROLES]);
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { error } = await supabase.from("categories").insert({
    name: parsed.data.name,
    description: parsed.data.description || null,
    parent_id: parsed.data.parent_id || null,
    slug: slugify(parsed.data.name),
  });
  if (error) return { error: error.message.includes("duplicate") ? "Cette catégorie existe déjà" : error.message };

  revalidatePath("/categories");
  revalidatePath("/catalog");
  return {};
}

export async function updateCategory(id: string, input: CategoryInput) {
  await requireRole([...WRITE_ROLES]);
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      parent_id: parsed.data.parent_id || null,
      slug: slugify(parsed.data.name),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/categories");
  revalidatePath("/catalog");
  return {};
}

export async function deleteCategory(id: string) {
  await requireRole(["super_admin"]);
  const supabase = createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    return {
      error: error.message.includes("foreign key")
        ? "Impossible de supprimer : des produits utilisent cette catégorie."
        : error.message,
    };
  }
  revalidatePath("/categories");
  revalidatePath("/catalog");
  return {};
}
