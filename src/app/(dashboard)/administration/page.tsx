import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { AdministrationTabs } from "@/components/administration/AdministrationTabs";
import { StoresManager } from "@/components/stores/StoresManager";
import { UsersManager, type UserRow } from "@/components/users/UsersManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/auth/permissions";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { PasswordSettingsForm } from "@/components/settings/PasswordSettingsForm";
import { PushNotificationToggle } from "@/components/settings/PushNotificationToggle";
import { formatDate } from "@/lib/utils";
import type { Profile, Store } from "@/types/database.types";

export const dynamic = "force-dynamic";

type ProfileWithStore = Profile & { stores: { name: string } | null };

const PLAN_LABELS: Record<string, string> = {
  trial: "Essai gratuit",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Entreprise",
};

export default async function AdministrationPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();
  const isSuperAdmin = profile.role === "super_admin";

  const [{ data: allStores }, { data: activeStores }, { data: users }, { count: storeCount }, { count: userCount }, { data: tenant }] =
    await Promise.all([
      isSuperAdmin ? supabase.from("stores").select("*").order("created_at") : Promise.resolve({ data: [] as Store[] }),
      isSuperAdmin
        ? supabase.from("stores").select("*").eq("is_active", true).order("name")
        : Promise.resolve({ data: [] as Store[] }),
      isSuperAdmin
        ? supabase.from("profiles").select("*, stores:store_id ( name )").order("created_at")
        : Promise.resolve({ data: [] }),
      supabase.from("stores").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("tenants").select("max_stores, max_users, trial_ends_at").eq("id", profile.tenant_id).single(),
    ]);

  const userRows: UserRow[] = ((users ?? []) as unknown as ProfileWithStore[]).map(({ stores: store, ...rest }) => ({
    ...rest,
    store_name: store?.name ?? null,
  }));

  return (
    <AdministrationTabs role={profile.role}>
      {{
        stores: <StoresManager stores={allStores ?? []} />,
        users: <UsersManager users={userRows} stores={activeStores ?? []} currentUserId={profile.id} />,
        settings: (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Mon profil</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProfileSettingsForm profile={profile} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sécurité</CardTitle>
                </CardHeader>
                <CardContent>
                  <PasswordSettingsForm />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mon rôle</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium text-slate-900">{ROLE_LABELS[profile.role]}</p>
                  <p className="text-slate-500">{ROLE_DESCRIPTIONS[profile.role]}</p>
                  {profile.store_name && (
                    <p className="text-slate-500">
                      Magasin assigné : <span className="font-medium text-slate-700">{profile.store_name}</span>
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mon entreprise</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900">{profile.tenant_name}</p>
                    <Badge tone={profile.tenant_status === "active" ? "success" : "warning"}>
                      {PLAN_LABELS[profile.tenant_plan]}
                    </Badge>
                  </div>
                  {profile.tenant_status === "trial" && tenant && (
                    <p className="text-slate-500">Essai gratuit jusqu&apos;au {formatDate(tenant.trial_ends_at)}</p>
                  )}
                  <p className="text-slate-500">
                    Magasins : <span className="font-medium text-slate-700">{storeCount ?? 0}</span> /{" "}
                    {tenant?.max_stores ?? "—"}
                  </p>
                  <p className="text-slate-500">
                    Utilisateurs : <span className="font-medium text-slate-700">{userCount ?? 0}</span> /{" "}
                    {tenant?.max_users ?? "—"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <PushNotificationToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
                </CardContent>
              </Card>
            </div>
          </div>
        ),
      }}
    </AdministrationTabs>
  );
}
