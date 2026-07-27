import { ShieldAlert } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";

export default async function SuspendedPage() {
  const profile = await getCurrentProfile();

  const isCancelled = profile.tenant_status === "cancelled";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <ShieldAlert className="h-6 w-6 text-red-600" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">
          {isCancelled ? "Abonnement résilié" : "Compte suspendu"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          L&apos;accès de <span className="font-medium text-slate-700">{profile.tenant_name}</span> à la
          plateforme est actuellement {isCancelled ? "résilié" : "suspendu"}. Contactez votre administrateur
          ou notre équipe commerciale pour réactiver votre abonnement.
        </p>
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="secondary" className="w-full">
            Se déconnecter
          </Button>
        </form>
      </div>
    </div>
  );
}
