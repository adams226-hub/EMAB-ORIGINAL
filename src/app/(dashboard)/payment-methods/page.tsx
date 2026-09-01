import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PaymentMethodsManager } from "@/components/payment-methods/PaymentMethodsManager";

export const dynamic = "force-dynamic";

export default async function PaymentMethodsPage() {
  await requireRole(["super_admin"]);
  const supabase = createClient();

  const { data: methods } = await supabase.from("payment_methods").select("*").order("name");

  return <PaymentMethodsManager methods={methods ?? []} canDelete />;
}
