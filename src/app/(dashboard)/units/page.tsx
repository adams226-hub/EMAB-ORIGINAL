import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { UnitsManager } from "@/components/units/UnitsManager";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const profile = await requireRole(["super_admin", "manager"]);
  const supabase = createClient();

  const { data: units } = await supabase.from("units").select("*").order("name");

  return <UnitsManager units={units ?? []} canDelete={profile.role === "super_admin"} />;
}
