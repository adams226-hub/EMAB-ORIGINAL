"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { PaymentType } from "@/types/database.types";

const recordPaymentSchema = z.object({
  type: z.enum(["sale_payment"]),
  reference_id: z.string().uuid(),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  payment_method_id: z.string().uuid("Mode de paiement requis"),
  notes: z.string().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export async function recordPayment(input: RecordPaymentInput) {
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { error } = await supabase.rpc("fn_record_payment", {
    p_type: parsed.data.type as PaymentType,
    p_reference_id: parsed.data.reference_id,
    p_amount: parsed.data.amount,
    p_payment_method_id: parsed.data.payment_method_id,
    p_notes: parsed.data.notes || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/sales");
  revalidatePath("/receivables");
  revalidatePath("/finance");
  return {};
}
