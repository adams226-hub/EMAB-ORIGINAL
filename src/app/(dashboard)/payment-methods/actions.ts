"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

const methodSchema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  is_cash: z.boolean().default(false),
});

export type PaymentMethodInput = z.infer<typeof methodSchema>;

const WRITE_ROLES = ["super_admin"] as const;

export async function createPaymentMethod(input: PaymentMethodInput) {
  await requireRole([...WRITE_ROLES]);
  const parsed = methodSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { error } = await supabase.from("payment_methods").insert(parsed.data);
  if (error) return { error: error.message.includes("duplicate") ? "Ce mode de paiement existe déjà" : error.message };

  revalidatePath("/payment-methods");
  return {};
}

export async function updatePaymentMethod(id: string, input: PaymentMethodInput) {
  await requireRole([...WRITE_ROLES]);
  const parsed = methodSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { error } = await supabase.from("payment_methods").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/payment-methods");
  return {};
}

export async function togglePaymentMethodActive(id: string, isActive: boolean) {
  await requireRole([...WRITE_ROLES]);
  const supabase = createClient();
  const { error } = await supabase.from("payment_methods").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/payment-methods");
  return {};
}

export async function deletePaymentMethod(id: string) {
  await requireRole(["super_admin"]);
  const supabase = createClient();
  const { error } = await supabase.from("payment_methods").delete().eq("id", id);
  if (error) {
    return {
      error: error.message.includes("foreign key")
        ? "Impossible de supprimer : ce mode de paiement est utilisé par des paiements enregistrés."
        : error.message,
    };
  }
  revalidatePath("/payment-methods");
  return {};
}
