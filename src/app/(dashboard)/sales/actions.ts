"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function cancelSale(id: string, reason: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_cancel_sale", { p_sale_id: id, p_reason: reason || null });
  if (error) return { error: error.message };

  revalidatePath(`/sales/${id}`);
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  return {};
}
