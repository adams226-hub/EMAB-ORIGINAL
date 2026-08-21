"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

const importRowSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(2),
  category: z.string().optional(),
  unit: z.string().optional(),
  purchase_price: z.coerce.number().min(0).default(0),
  sale_price: z.coerce.number().min(0),
  description: z.string().optional(),
});

export type ProductImportRow = z.infer<typeof importRowSchema>;

export interface ImportSummary {
  created: number;
  skipped: { sku: string; reason: string }[];
}

/**
 * Import massif de produits depuis un CSV déjà parsé côté client
 * (aperçu affiché avant confirmation). Les catégories mentionnées par
 * nom sont réutilisées si elles existent, créées à la volée sinon (si
 * le rôle le permet — un magasinier ne peut pas créer de catégorie,
 * la ligne est alors importée sans catégorie plutôt que rejetée).
 */
export async function importProducts(rows: unknown[]): Promise<{ error?: string; summary?: ImportSummary }> {
  const profile = await requireRole(["super_admin", "manager", "stock_keeper"]);
  const canCreateCategories = profile.role === "super_admin" || profile.role === "manager";

  const parsedRows: ProductImportRow[] = [];
  const skipped: ImportSummary["skipped"] = [];

  for (const raw of rows) {
    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      const sku = typeof (raw as Record<string, unknown>)?.sku === "string" ? (raw as { sku: string }).sku : "?";
      skipped.push({ sku, reason: parsed.error.issues[0]?.message ?? "Ligne invalide" });
      continue;
    }
    parsedRows.push(parsed.data);
  }

  if (parsedRows.length === 0) {
    return { summary: { created: 0, skipped } };
  }

  const supabase = createClient();

  const { data: existingProducts } = await supabase.from("products").select("sku");
  const existingSkus = new Set((existingProducts ?? []).map((p) => p.sku));

  const categoryNames = Array.from(new Set(parsedRows.map((r) => r.category?.trim()).filter(Boolean))) as string[];
  const categoryIdByName = new Map<string, string>();

  if (categoryNames.length > 0) {
    const { data: existingCategories } = await supabase.from("categories").select("id, name").in("name", categoryNames);
    for (const c of existingCategories ?? []) categoryIdByName.set(c.name, c.id);

    if (canCreateCategories) {
      const missing = categoryNames.filter((name) => !categoryIdByName.has(name));
      for (const name of missing) {
        const { data: created } = await supabase
          .from("categories")
          .insert({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") })
          .select("id, name")
          .single();
        if (created) categoryIdByName.set(created.name, created.id);
      }
    }
  }

  const toInsert = [];
  for (const row of parsedRows) {
    if (existingSkus.has(row.sku)) {
      skipped.push({ sku: row.sku, reason: "SKU déjà existant" });
      continue;
    }
    toInsert.push({
      name: row.name,
      sku: row.sku,
      category_id: row.category ? categoryIdByName.get(row.category.trim()) ?? null : null,
      unit: row.unit || "pièce",
      purchase_price: row.purchase_price,
      sale_price: row.sale_price,
      description: row.description || null,
      created_by: profile.id,
    });
    existingSkus.add(row.sku);
  }

  let created = 0;
  if (toInsert.length > 0) {
    const { error, count } = await supabase.from("products").insert(toInsert, { count: "exact" });
    if (error) return { error: error.message };
    created = count ?? toInsert.length;
  }

  revalidatePath("/products");
  revalidatePath("/catalog");
  return { summary: { created, skipped } };
}
