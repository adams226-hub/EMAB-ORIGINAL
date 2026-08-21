import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { CatalogTabs } from "@/components/catalog/CatalogTabs";
import { ProductsManager, type ProductRow } from "@/components/products/ProductsManager";
import { CategoriesManager } from "@/components/categories/CategoriesManager";
import { UnitsManager } from "@/components/units/UnitsManager";
import type { Product } from "@/types/database.types";

export const dynamic = "force-dynamic";

type ProductWithCategory = Product & { categories: { name: string } | null };

export default async function CatalogPage() {
  const profile = await requireRole(["super_admin", "manager", "stock_keeper"]);
  const supabase = createClient();

  const [{ data: products }, { data: categories }, { data: stockRows }, { data: stores }, { data: units }] =
    await Promise.all([
      supabase.from("products").select("*, categories ( name )").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
      supabase.from("product_stock").select("product_id, quantity"),
      profile.role === "super_admin"
        ? supabase.from("stores").select("*").eq("is_active", true).order("name")
        : Promise.resolve({ data: [] }),
      supabase.from("units").select("*").order("name"),
    ]);

  const stockByProduct = new Map<string, number>();
  for (const row of stockRows ?? []) {
    stockByProduct.set(row.product_id, (stockByProduct.get(row.product_id) ?? 0) + Number(row.quantity));
  }

  const productRows = (products ?? []) as unknown as ProductWithCategory[];

  const rows: ProductRow[] = productRows.map(({ categories: cat, ...rest }) => ({
    ...rest,
    category_name: cat?.name ?? null,
    total_stock: stockByProduct.get(rest.id) ?? 0,
  }));

  const canDelete = profile.role === "super_admin";

  return (
    <CatalogTabs role={profile.role}>
      {{
        products: (
          <ProductsManager
            products={rows}
            categories={categories ?? []}
            stores={stores ?? []}
            canDelete={canDelete}
            hasOwnStore={Boolean(profile.store_id)}
          />
        ),
        categories: <CategoriesManager categories={categories ?? []} canDelete={canDelete} />,
        units: <UnitsManager units={units ?? []} canDelete={canDelete} />,
      }}
    </CatalogTabs>
  );
}
