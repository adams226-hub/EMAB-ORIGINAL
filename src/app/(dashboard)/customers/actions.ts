"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

const customerSchema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().or(z.literal("")).nullable(),
  address: z.string().optional().nullable(),
  credit_limit: z.coerce.number().min(0).default(0),
});

export type CustomerInput = z.infer<typeof customerSchema>;

const WRITE_ROLES = ["super_admin", "manager", "cashier"] as const;

export async function createCustomer(input: CustomerInput) {
  await requireRole([...WRITE_ROLES]);
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { data, error } = await supabase.from("customers").insert(parsed.data).select("id").single();
  if (error) return { error: error.message };

  revalidatePath("/customers");
  return { id: data.id };
}

export async function updateCustomer(id: string, input: CustomerInput) {
  await requireRole([...WRITE_ROLES]);
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { error } = await supabase.from("customers").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/customers");
  return {};
}

export async function toggleCustomerActive(id: string, isActive: boolean) {
  await requireRole([...WRITE_ROLES]);
  const supabase = createClient();
  const { error } = await supabase.from("customers").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/customers");
  return {};
}

export async function deleteCustomer(id: string) {
  await requireRole(["super_admin"]);
  const supabase = createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) {
    return {
      error: error.message.includes("foreign key")
        ? "Impossible de supprimer : ce client a des ventes associées."
        : error.message,
    };
  }
  revalidatePath("/customers");
  return {};
}
