import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/auth/permissions";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { PasswordSettingsForm } from "@/components/settings/PasswordSettingsForm";
import { PushNotificationToggle } from "@/components/settings/PushNotificationToggle";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PLAN_LABELS: Record<string, string> = {
  trial: "Essai gratuit",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Entreprise",
};

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const [{ count: storeCount }, { count: userCount }, { data: tenant }] = await Promise.all([
    supabase.from("stores").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("tenants").select("max_stores, max_users, trial_ends_at").eq("id", profile.tenant_id).single(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">Gérez vos informations personnelles et votre sécurité.</p>
      </div>

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
  );
}
