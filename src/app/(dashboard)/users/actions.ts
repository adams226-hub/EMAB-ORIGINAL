"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/session";

const roleEnum = z.enum(["super_admin", "manager", "cashier", "stock_keeper"]);

const createUserSchema = z.object({
  full_name: z.string().min(2, "Le nom complet est requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  role: roleEnum,
  store_id: z.string().uuid().optional().nullable().or(z.literal("")),
});

const updateUserSchema = z.object({
  full_name: z.string().min(2, "Le nom complet est requis"),
  role: roleEnum,
  store_id: z.string().uuid().optional().nullable().or(z.literal("")),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

function normalizeStoreId(role: string, storeId: string | null | undefined) {
  return role === "super_admin" ? null : storeId || null;
}

export async function createUser(input: CreateUserInput) {
  const requester = await requireRole(["super_admin"]);
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const [{ count: userCount }, { data: tenant }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("tenants").select("max_users").eq("id", requester.tenant_id).single(),
  ]);

  if (tenant && (userCount ?? 0) >= tenant.max_users) {
    return {
      error: `Limite de votre abonnement atteinte (${tenant.max_users} utilisateurs). Passez à un plan supérieur pour en ajouter.`,
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      store_id: normalizeStoreId(parsed.data.role, parsed.data.store_id),
      // Rattache le nouvel utilisateur au MÊME tenant que l'invitant —
      // sans ce champ, handle_new_user() (0021) refuserait l'insertion.
      tenant_id: requester.tenant_id,
    },
  });

  if (error) {
    return {
      error: error.message.includes("already registered")
        ? "Un compte existe déjà avec cet email"
        : error.message,
    };
  }

  revalidatePath("/users");
  revalidatePath("/administration");
  revalidatePath("/dashboard");
  return {};
}

export async function updateUser(id: string, input: UpdateUserInput) {
  await requireRole(["super_admin"]);
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      store_id: normalizeStoreId(parsed.data.role, parsed.data.store_id),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/users");
  revalidatePath("/administration");
  return {};
}

export async function toggleUserActive(id: string, isActive: boolean) {
  await requireRole(["super_admin"]);
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/users");
  revalidatePath("/administration");
  return {};
}

export async function deleteUser(id: string) {
  const requester = await requireRole(["super_admin"]);
  if (requester.id === id) return { error: "Vous ne pouvez pas supprimer votre propre compte." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: error.message };

  revalidatePath("/users");
  revalidatePath("/administration");
  revalidatePath("/dashboard");
  return {};
}
