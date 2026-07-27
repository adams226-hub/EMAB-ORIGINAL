"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

const WRITE_ROLES = ["super_admin", "manager", "cashier"] as const;

export async function openCashSession(storeId: string, openingAmount: number) {
  await requireRole([...WRITE_ROLES]);
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_open_cash_session", {
    p_store_id: storeId,
    p_opening_amount: openingAmount,
  });
  if (error) return { error: error.message };
  revalidatePath("/cash-register");
  return {};
}

export async function closeCashSession(sessionId: string, closingAmount: number, notes?: string) {
  await requireRole([...WRITE_ROLES]);
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_close_cash_session", {
    p_session_id: sessionId,
    p_closing_amount: closingAmount,
    p_notes: notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/cash-register");
  return {};
}

const adjustmentSchema = z.object({
  cash_session_id: z.string().uuid(),
  type: z.enum(["in", "out"]),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  reason: z.string().min(2, "Le motif est requis"),
});

export async function addCashAdjustment(input: z.infer<typeof adjustmentSchema>) {
  const profile = await requireRole([...WRITE_ROLES]);
  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (!profile.store_id && profile.role !== "super_admin") {
    return { error: "Aucun magasin associé à votre compte." };
  }

  const supabase = createClient();
  const { data: session } = await supabase
    .from("cash_sessions")
    .select("store_id")
    .eq("id", parsed.data.cash_session_id)
    .single();

  if (!session) return { error: "Session de caisse introuvable" };

  const { error } = await supabase.from("cash_adjustments").insert({
    cash_session_id: parsed.data.cash_session_id,
    store_id: session.store_id,
    type: parsed.data.type,
    amount: parsed.data.amount,
    reason: parsed.data.reason,
    created_by: profile.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/cash-register");
  return {};
}
