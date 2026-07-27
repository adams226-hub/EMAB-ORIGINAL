import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { StoresManager } from "@/components/stores/StoresManager";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  await requireRole(["super_admin"]);
  const supabase = createClient();

  const { data: stores } = await supabase.from("stores").select("*").order("created_at");

  return <StoresManager stores={stores ?? []} />;
}
