import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { CustomersManager } from "@/components/customers/CustomersManager";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const profile = await requireRole(["super_admin", "manager", "cashier"]);
  const supabase = createClient();

  const { data: customers } = await supabase.from("customers").select("*").order("name");

  return <CustomersManager customers={customers ?? []} canDelete={profile.role === "super_admin"} />;
}
