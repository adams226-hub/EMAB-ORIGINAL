import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { CategoriesManager } from "@/components/categories/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const profile = await requireRole(["super_admin", "manager", "stock_keeper"]);
  const supabase = createClient();

  const { data: categories } = await supabase.from("categories").select("*").order("name");

  return <CategoriesManager categories={categories ?? []} canDelete={profile.role === "super_admin"} />;
}
