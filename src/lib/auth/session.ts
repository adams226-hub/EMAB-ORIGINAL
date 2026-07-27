import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, TenantPlan, TenantStatus } from "@/types/database.types";

export interface SessionProfile extends Profile {
  store_name: string | null;
  tenant_name: string;
  tenant_plan: TenantPlan;
  tenant_status: TenantStatus;
}

type ProfileWithRelations = Profile & {
  stores: { name: string } | null;
  tenants: { name: string; plan: TenantPlan; status: TenantStatus } | null;
};

/**
 * Récupère le profil complet (rôle, magasin, entreprise) de l'utilisateur
 * connecté. À utiliser dans les Server Components / Route Handlers du
 * dashboard. Le statut d'abonnement (`tenant_status`) est vérifié par le
 * middleware, pas ici — cette fonction reste un simple accès aux données.
 */
export async function getCurrentProfile(): Promise<SessionProfile> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*, stores:store_id ( name ), tenants:tenant_id ( name, plan, status )")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  const { stores, tenants, ...rest } = profile as unknown as ProfileWithRelations;

  return {
    ...rest,
    store_name: stores?.name ?? null,
    tenant_name: tenants?.name ?? "—",
    tenant_plan: tenants?.plan ?? "trial",
    tenant_status: tenants?.status ?? "trial",
  };
}

export async function requireRole(allowed: SessionProfile["role"][]) {
  const profile = await getCurrentProfile();
  if (!allowed.includes(profile.role)) {
    redirect("/dashboard");
  }
  return profile;
}
